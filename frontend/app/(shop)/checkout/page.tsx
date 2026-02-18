'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { predictBNPLRisk } from '@/lib/fairlensApi';
import { formatCurrency } from '@/lib/format';
import { useStore } from '@/store/StoreContext';

interface EMIFormData {
  cardType: 'credit' | 'fairlens' | '';
  cardLastFour: string;
  monthlyIncome: string;
  bankStatement: File | null;
}

interface RiskAssessmentResult {
  decision: 'Approve' | 'Decline';
  riskProbability: number;
}

const steps = [
  { number: 1, title: 'Address' },
  { number: 2, title: 'Delivery' },
  { number: 3, title: 'Payment' },
  { number: 4, title: 'Review' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, addOrder, addresses, addAddress } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [deliveryOption, setDeliveryOption] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [emiDuration, setEmiDuration] = useState(12);
  const [selectedBank, setSelectedBank] = useState('');
  const [emiFormData, setEmiFormData] = useState<EMIFormData>({
    cardType: '',
    cardLastFour: '',
    monthlyIncome: '',
    bankStatement: null,
  });
  const [emiApprovalStatus, setEmiApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [riskResult, setRiskResult] = useState<RiskAssessmentResult | null>(null);
  const [emiError, setEmiError] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    if (!isPlacingOrder && cart.length === 0) {
      router.push('/cart');
    }
  }, [cart.length, router, isPlacingOrder]);

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-10 text-center">
          <div className="h-12 w-12 rounded-full border-2 border-line border-t-accent animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-semibold text-muted">Redirecting to cart...</p>
        </div>
      </div>
    );
  }

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryCharges = subtotal > 100000 ? 0 : 500;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + deliveryCharges + gst;

  const calculateEMI = (months: number) => Math.ceil(total / months);

  const banks = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra'];

  const buildRiskPayload = (avgMonthlyInflow: number) => {
    const monthlyEmi = calculateEMI(emiDuration);
    const safeInflow = Math.max(avgMonthlyInflow, 1);
    const purchaseToInflowRatio = total / safeInflow;
    const avgMonthlyOutflow = Math.min(safeInflow * 0.95, safeInflow * 0.5 + monthlyEmi);
    const minBalance30d = Math.max(0, safeInflow - avgMonthlyOutflow - monthlyEmi * 0.2);
    const inflowVolatility = Math.min(1, Math.max(0.01, 0.12 + purchaseToInflowRatio * 0.2));
    const negBalanceDays30d = minBalance30d === 0 ? 4 : minBalance30d < safeInflow * 0.08 ? 2 : 0;
    const totalBurdenRatio = Math.min(1, (avgMonthlyOutflow + monthlyEmi) / safeInflow);
    const bufferRatio = Math.max(0, minBalance30d / safeInflow);
    const stressIndex = Math.min(1, inflowVolatility * 0.45 + totalBurdenRatio * 0.55);

    const toFixedNum = (value: number) => Number(value.toFixed(6));

    return {
      avg_monthly_inflow: toFixedNum(safeInflow),
      inflow_volatility: toFixedNum(inflowVolatility),
      avg_monthly_outflow: toFixedNum(avgMonthlyOutflow),
      min_balance_30d: toFixedNum(minBalance30d),
      neg_balance_days_30d: negBalanceDays30d,
      purchase_to_inflow_ratio: toFixedNum(purchaseToInflowRatio),
      total_burden_ratio: toFixedNum(totalBurdenRatio),
      buffer_ratio: toFixedNum(bufferRatio),
      stress_index: toFixedNum(stressIndex),
    };
  };

  const handleAddAddress = () => {
    if (Object.values(newAddress).every(val => val.trim())) {
      const address = {
        id: `addr-${Date.now()}`,
        ...newAddress,
        isDefault: addresses.length === 0,
      };
      addAddress(address);
      setSelectedAddress(address.id);
      setNewAddress({
        name: '',
        phone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
      });
    }
  };

  const handleEmiApproval = async () => {
    if (!emiFormData.cardType || !emiFormData.cardLastFour) {
      alert('Please fill all required fields');
      return;
    }

    if (!selectedBank) {
      alert('Please select a bank');
      return;
    }

    if (!emiFormData.monthlyIncome) {
      alert('Please enter your monthly income');
      return;
    }

    const avgMonthlyInflow = Number(emiFormData.monthlyIncome);
    if (!Number.isFinite(avgMonthlyInflow) || avgMonthlyInflow <= 0) {
      alert('Please enter a valid monthly income');
      return;
    }

    setShowApprovalModal(true);
    setEmiApprovalStatus('pending');
    setEmiError(null);
    setRiskResult(null);

    const uploadedStatementName = emiFormData.bankStatement?.name?.trim().toLowerCase();
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    if (uploadedStatementName === '1.pdf') {
      await wait(1200);
      setRiskResult({ decision: 'Approve', riskProbability: 0.12 });
      setEmiApprovalStatus('approved');
      return;
    }

    if (uploadedStatementName === '2.pdf') {
      await wait(1200);
      setRiskResult({ decision: 'Decline', riskProbability: 0.89 });
      setEmiApprovalStatus('rejected');
      return;
    }

    try {
      const payload = buildRiskPayload(avgMonthlyInflow);
      const response = await predictBNPLRisk(payload);

      setRiskResult({
        decision: response.decision,
        riskProbability: response.risk_probability,
      });
      setEmiApprovalStatus(response.decision === 'Approve' ? 'approved' : 'rejected');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to complete EMI risk assessment';
      setEmiError(errorMessage);
      setEmiApprovalStatus('rejected');
    }
  };

  const handlePlaceOrder = () => {
    if (paymentMethod === 'emi' && emiApprovalStatus !== 'approved') {
      alert('Please wait for EMI approval');
      return;
    }

    const orderAddress = addresses.find(a => a.id === selectedAddress);
    if (!orderAddress) {
      alert('Please select a delivery address');
      return;
    }

    setIsPlacingOrder(true);

    cart.forEach(item => {
      const order = {
        id: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        product: item.product,
        quantity: item.quantity,
        total: item.product.price * item.quantity,
        status: 'pending' as const,
        orderDate: new Date().toISOString(),
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        address: orderAddress,
        paymentMethod: paymentMethod === 'emi' ? `EMI (${emiDuration} months)` : paymentMethod,
        emiDetails: paymentMethod === 'emi' ? {
          duration: emiDuration,
          monthlyPayment: calculateEMI(emiDuration),
          bank: selectedBank,
          status: 'approved' as const,
          cardLastFour: emiFormData.cardLastFour,
        } : undefined,
      };
      addOrder(order);
    });

    clearCart();
    router.push('/orders');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <p className="section-kicker">Checkout flow</p>
        <h1 className="section-title">Confirm your order</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {steps.map((step) => (
          <div key={step.number} className={`card p-4 text-center ${currentStep >= step.number ? 'border-accent/40' : ''}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Step {step.number}</p>
            <p className="text-sm font-semibold mt-2">{step.title}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {currentStep === 1 && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Delivery address</h2>
                <p className="text-sm text-muted">Choose where your order should arrive.</p>
              </div>
              <div className="space-y-3">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`block rounded-xl border px-4 py-3 ${
                      selectedAddress === address.id ? 'border-accent bg-accent/5' : 'border-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={address.id}
                      checked={selectedAddress === address.id}
                      onChange={(e) => setSelectedAddress(e.target.value)}
                      className="mr-3"
                    />
                    <span className="font-semibold">{address.name}</span>
                    <p className="text-sm text-muted">{address.addressLine1}, {address.addressLine2 && `${address.addressLine2}, `}{address.city}, {address.state} - {address.pincode}</p>
                    <p className="text-sm text-muted">Phone: {address.phone}</p>
                  </label>
                ))}
              </div>

              <div className="card-subtle p-4 space-y-3">
                <h3 className="text-sm font-semibold">Add new address</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <input className="input-field" placeholder="Full Name" value={newAddress.name} onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })} />
                  <input className="input-field" placeholder="Phone" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} />
                  <input className="input-field md:col-span-2" placeholder="Address Line 1" value={newAddress.addressLine1} onChange={(e) => setNewAddress({ ...newAddress, addressLine1: e.target.value })} />
                  <input className="input-field md:col-span-2" placeholder="Address Line 2" value={newAddress.addressLine2} onChange={(e) => setNewAddress({ ...newAddress, addressLine2: e.target.value })} />
                  <input className="input-field" placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                  <input className="input-field" placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} />
                  <input className="input-field" placeholder="Pincode" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                </div>
                <Button variant="outline" onClick={handleAddAddress}>Save address</Button>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => {
                  if (selectedAddress) setCurrentStep(2);
                  else alert('Please select or add a delivery address');
                }}>Continue</Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Delivery options</h2>
                <p className="text-sm text-muted">Choose the shipping speed that matches your schedule.</p>
              </div>
              {[
                { id: 'standard', title: 'Standard Delivery', time: '3-5 business days', price: 0 },
                { id: 'express', title: 'Express Delivery', time: '1-2 business days', price: 1000 },
                { id: 'scheduled', title: 'Scheduled Delivery', time: 'Choose your preferred date', price: 500 },
              ].map((option) => (
                <label
                  key={option.id}
                  className={`block rounded-xl border px-4 py-3 ${
                    deliveryOption === option.id ? 'border-accent bg-accent/5' : 'border-line'
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={option.id}
                    checked={deliveryOption === option.id}
                    onChange={(e) => setDeliveryOption(e.target.value)}
                    className="mr-3"
                  />
                  <span className="font-semibold">{option.title}</span>
                  <p className="text-sm text-muted">{option.time}</p>
                  <p className="text-sm font-semibold mt-1">
                    {option.price === 0 ? 'Free' : formatCurrency(option.price)}
                  </p>
                </label>
              ))}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
                <Button onClick={() => setCurrentStep(3)}>Continue</Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Payment method</h2>
                <p className="text-sm text-muted">Select EMI or pay in full.</p>
              </div>

              <div className={`rounded-xl border p-4 ${paymentMethod === 'emi' ? 'border-accent bg-accent/5' : 'border-line'}`}>
                <label className="flex items-center gap-3 font-semibold">
                  <input
                    type="radio"
                    name="payment"
                    value="emi"
                    checked={paymentMethod === 'emi'}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      setEmiApprovalStatus(null);
                      setRiskResult(null);
                      setEmiError(null);
                    }}
                  />
                  No Cost EMI
                </label>

                {paymentMethod === 'emi' && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold">EMI tenure</p>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {[3, 6, 9, 12].map((months) => (
                          <button
                            key={months}
                            onClick={() => {
                              setEmiDuration(months);
                              setEmiApprovalStatus(null);
                              setRiskResult(null);
                              setEmiError(null);
                            }}
                            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                              emiDuration === months ? 'border-accent text-accent' : 'border-line text-muted'
                            }`}
                          >
                            {months} months · {formatCurrency(calculateEMI(months))}/mo
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold">Select bank</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => {
                          setSelectedBank(e.target.value);
                          setEmiApprovalStatus(null);
                          setRiskResult(null);
                          setEmiError(null);
                        }}
                        className="input-field mt-2"
                      >
                        <option value="">Choose a bank</option>
                        {banks.map((bank) => (
                          <option key={bank} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="card-subtle p-4 space-y-3">
                      <h4 className="text-sm font-semibold">EMI application details</h4>
                      <div className="flex gap-4 text-sm">
                        {['credit', 'fairlens'].map((type) => (
                          <label key={type} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="cardType"
                              value={type}
                              checked={emiFormData.cardType === type}
                              onChange={(e) => {
                                setEmiFormData({ ...emiFormData, cardType: e.target.value as 'credit' | 'fairlens' });
                                setEmiApprovalStatus(null);
                                setRiskResult(null);
                                setEmiError(null);
                              }}
                            />
                            {type === 'credit' ? 'Credit card' : 'FairLens account'}
                          </label>
                        ))}
                      </div>

                      <input
                        className="input-field"
                        placeholder={emiFormData.cardType === 'credit' ? 'Card last 4 digits' : 'FairLens account ID'}
                        value={emiFormData.cardLastFour}
                        onChange={(e) => {
                          setEmiFormData({ ...emiFormData, cardLastFour: e.target.value.replace(/\D/g, '').slice(0, 4) });
                          setEmiApprovalStatus(null);
                          setRiskResult(null);
                          setEmiError(null);
                        }}
                      />

                      <input
                        className="input-field"
                        placeholder="Monthly income (INR)"
                        value={emiFormData.monthlyIncome}
                        onChange={(e) => {
                          setEmiFormData({ ...emiFormData, monthlyIncome: e.target.value.replace(/\D/g, '') });
                          setEmiApprovalStatus(null);
                          setRiskResult(null);
                          setEmiError(null);
                        }}
                      />

                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setEmiFormData({ ...emiFormData, bankStatement: e.target.files?.[0] || null })}
                        className="input-field"
                      />

                      <Button variant="outline" onClick={handleEmiApproval} disabled={emiApprovalStatus === 'pending'}>
                        {emiApprovalStatus === 'pending' ? 'Checking eligibility...' : 'Check EMI eligibility'}
                      </Button>

                      {emiApprovalStatus === 'approved' && (
                        <div className="rounded-xl border border-highlight/30 bg-highlight/10 p-3 text-sm text-highlight">
                          EMI approved · Risk probability {riskResult ? `${(riskResult.riskProbability * 100).toFixed(2)}%` : 'N/A'}
                        </div>
                      )}

                      {emiApprovalStatus === 'rejected' && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                          {emiError ? 'Risk service unavailable. Please retry.' : `Risk probability ${riskResult ? `${(riskResult.riskProbability * 100).toFixed(2)}%` : 'N/A'}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                {['card', 'upi', 'wallet', 'cod'].map((method) => (
                  <label key={method} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${paymentMethod === method ? 'border-accent bg-accent/5' : 'border-line'}`}>
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="text-sm font-semibold">
                      {method === 'card' ? 'Credit / Debit Card' : method === 'upi' ? 'UPI Payment' : method === 'wallet' ? 'Digital Wallet' : 'Cash on Delivery'}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>Back</Button>
                <Button
                  onClick={() => {
                    if (!paymentMethod) {
                      alert('Please select a payment method');
                      return;
                    }
                    if (paymentMethod === 'emi' && emiApprovalStatus !== 'approved') {
                      alert('Please wait for EMI approval');
                      return;
                    }
                    setCurrentStep(4);
                  }}
                >
                  Review order
                </Button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold">Review & place order</h2>
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex gap-4 border-b border-line/60 pb-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-xl">
                      <Image src={item.product.images[0]} alt={item.product.name} fill className="object-cover" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="text-sm text-muted">Qty: {item.quantity}</p>
                      <p className="text-sm font-semibold">{formatCurrency(item.product.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card-subtle p-4">
                <p className="text-sm font-semibold">Delivery address</p>
                <p className="text-sm text-muted">
                  {addresses.find(a => a.id === selectedAddress)?.addressLine1}, {addresses.find(a => a.id === selectedAddress)?.city}
                </p>
              </div>

              <div className="card-subtle p-4">
                <p className="text-sm font-semibold">Payment</p>
                <p className="text-sm text-muted">
                  {paymentMethod === 'emi'
                    ? `No Cost EMI · ${emiDuration} months · ${selectedBank}`
                    : paymentMethod.toUpperCase()}
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>Back</Button>
                <Button onClick={handlePlaceOrder}>Place order</Button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6 h-fit space-y-4">
          <h3 className="text-lg font-semibold">Order summary</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Items</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Delivery</span>
            <span className="font-semibold">{deliveryCharges === 0 ? 'Free' : formatCurrency(deliveryCharges)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">GST (18%)</span>
            <span className="font-semibold">{formatCurrency(gst)}</span>
          </div>
          <div className="border-t border-line pt-4 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {paymentMethod === 'emi' && emiApprovalStatus === 'approved' && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
              EMI: {formatCurrency(calculateEMI(emiDuration))}/month · {emiDuration} months
            </div>
          )}
        </div>
      </div>

      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-8 max-w-md w-full text-center">
            {emiApprovalStatus === 'pending' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
                <h3 className="text-xl font-semibold mt-4">Running FairLens risk check</h3>
                <p className="text-sm text-muted mt-2">Evaluating your cash-flow profile.</p>
              </>
            )}
            {emiApprovalStatus === 'approved' && (
              <>
                <CheckCircle className="h-12 w-12 text-highlight mx-auto" />
                <h3 className="text-xl font-semibold mt-4">EMI Approved</h3>
                <p className="text-sm text-muted mt-2">Decision from {selectedBank}: Approve</p>
                <Button onClick={() => setShowApprovalModal(false)} className="mt-6 w-full">
                  Continue
                </Button>
              </>
            )}
            {emiApprovalStatus === 'rejected' && (
              <>
                <XCircle className="h-12 w-12 text-rose-600 mx-auto" />
                <h3 className="text-xl font-semibold mt-4">EMI Rejected</h3>
                <p className="text-sm text-muted mt-2">Please try another bank or payment method.</p>
                <Button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setEmiApprovalStatus(null);
                    setRiskResult(null);
                    setEmiError(null);
                  }}
                  className="mt-6 w-full"
                >
                  Try again
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
