'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useStore } from '@/store/StoreContext';
import Button from '@/components/Button';
import { Check, ChevronRight, CreditCard, Smartphone, Wallet, Banknote, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { predictBNPLRisk } from '@/lib/fairlensApi';

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

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, auth, addOrder, addresses, addAddress } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [deliveryOption, setDeliveryOption] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [emiDuration, setEmiDuration] = useState(12);
  const [selectedBank, setSelectedBank] = useState('');
  const [showEmiForm, setShowEmiForm] = useState(false);
  const [emiFormData, setEmiFormData] = useState<EMIFormData>({
    cardType: '',
    cardLastFour: '',
    monthlyIncome: '',
    bankStatement: null,
  });
  const [emiApprovalStatus, setEmiApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
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

  // Redirect if cart is empty - use useEffect to prevent issues
  useEffect(() => {
    if (cart.length === 0) {
      router.push('/cart');
    }
  }, [cart.length, router]);

  // Show loading while checking cart
  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-primary animate-spin mx-auto mb-4"></div>
          <p className="font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discount = cart.reduce(
    (sum, item) => sum + (item.product.originalPrice - item.product.price) * item.quantity,
    0
  );
  const deliveryCharges = subtotal > 100000 ? 0 : 500;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + deliveryCharges + gst;

  const calculateEMI = (months: number) => {
    return Math.ceil(total / months);
  };

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

    // Demo-only shortcut for hackathon flow:
    // 1.pdf => force approve, 2.pdf => force decline.
    if (uploadedStatementName === '1.pdf') {
      await wait(1200);
      setRiskResult({
        decision: 'Approve',
        riskProbability: 0.12,
      });
      setEmiApprovalStatus('approved');
      return;
    }

    if (uploadedStatementName === '2.pdf') {
      await wait(1200);
      setRiskResult({
        decision: 'Decline',
        riskProbability: 0.89,
      });
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to complete EMI risk assessment';
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

    cart.forEach(item => {
      const order = {
        id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  const steps = [
    { number: 1, title: 'Address', icon: '📍' },
    { number: 2, title: 'Delivery', icon: '🚚' },
    { number: 3, title: 'Payment', icon: '💳' },
    { number: 4, title: 'Review', icon: '✓' },
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">Checkout</h1>

        {/* Stepper */}
        <div className="mb-8 bg-white border-4 border-black shadow-brutal p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 flex items-center justify-center border-3 border-black font-black text-lg ${
                      currentStep >= step.number ? 'bg-primary text-white' : 'bg-white'
                    }`}
                  >
                    {currentStep > step.number ? <Check /> : step.icon}
                  </div>
                  <span className={`mt-2 font-bold text-sm hidden sm:block ${currentStep >= step.number ? 'text-primary' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className={`w-6 h-6 ${currentStep > step.number ? 'text-primary' : 'text-gray-400'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Address */}
            {currentStep === 1 && (
              <div className="border-4 border-black bg-white shadow-brutal">
                <div className="p-6 bg-accent border-b-4 border-black">
                  <h2 className="text-2xl font-black uppercase">Delivery Address</h2>
                </div>
                <div className="p-6 space-y-4">
                  {/* Existing Addresses */}
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={`block p-4 border-3 cursor-pointer transition-all ${
                        selectedAddress === address.id
                          ? 'border-primary bg-primary/10 shadow-brutal'
                          : 'border-black hover:shadow-brutal'
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
                      <span className="font-bold">{address.name}</span>
                      <p className="ml-6 font-semibold text-sm text-gray-700">
                        {address.addressLine1}, {address.addressLine2 && `${address.addressLine2}, `}
                        {address.city}, {address.state} - {address.pincode}
                      </p>
                      <p className="ml-6 font-semibold text-sm text-gray-700">Phone: {address.phone}</p>
                    </label>
                  ))}

                  {/* Add New Address Form */}
                  <div className="border-3 border-dashed border-black p-4">
                    <h3 className="font-black uppercase mb-4">Add New Address</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                      />
                      <input
                        type="text"
                        placeholder="Address Line 1"
                        value={newAddress.addressLine1}
                        onChange={(e) => setNewAddress({ ...newAddress, addressLine1: e.target.value })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal md:col-span-2"
                      />
                      <input
                        type="text"
                        placeholder="Address Line 2 (Optional)"
                        value={newAddress.addressLine2}
                        onChange={(e) => setNewAddress({ ...newAddress, addressLine2: e.target.value })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal md:col-span-2"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                      />
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        className="px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                        maxLength={6}
                      />
                      <Button onClick={handleAddAddress} size="sm">
                        Save Address
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (selectedAddress) setCurrentStep(2);
                      else alert('Please select or add a delivery address');
                    }}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Delivery Options */}
            {currentStep === 2 && (
              <div className="border-4 border-black bg-white shadow-brutal">
                <div className="p-6 bg-accent border-b-4 border-black">
                  <h2 className="text-2xl font-black uppercase">Delivery Options</h2>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { id: 'standard', title: 'Standard Delivery', time: '3-5 business days', price: 0 },
                    { id: 'express', title: 'Express Delivery', time: '1-2 business days', price: 1000 },
                    { id: 'scheduled', title: 'Scheduled Delivery', time: 'Choose your preferred date', price: 500 },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`block p-4 border-3 cursor-pointer transition-all ${
                        deliveryOption === option.id
                          ? 'border-primary bg-primary/10 shadow-brutal'
                          : 'border-black hover:shadow-brutal'
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
                      <div className="inline-block">
                        <span className="font-bold">{option.title}</span>
                        <p className="text-sm font-semibold text-gray-700">{option.time}</p>
                        <p className="text-sm font-bold text-primary mt-1">
                          {option.price === 0 ? 'FREE' : formatPrice(option.price)}
                        </p>
                      </div>
                    </label>
                  ))}

                  <div className="flex gap-4">
                    <Button onClick={() => setCurrentStep(1)} variant="outline" size="lg">
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(3)} className="flex-1" size="lg">
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Payment Options */}
            {currentStep === 3 && (
              <div className="border-4 border-black bg-white shadow-brutal">
                <div className="p-6 bg-accent border-b-4 border-black">
                  <h2 className="text-2xl font-black uppercase">Payment Method</h2>
                </div>
                <div className="p-6 space-y-6">
                  {/* EMI Option */}
                  <div className={`border-3 p-4 ${paymentMethod === 'emi' ? 'border-primary bg-primary/10' : 'border-black'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="payment"
                        value="emi"
                        checked={paymentMethod === 'emi'}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          setShowEmiForm(true);
                          setEmiApprovalStatus(null);
                          setRiskResult(null);
                          setEmiError(null);
                        }}
                      />
                      <CreditCard className="w-6 h-6" />
                      <span className="font-bold">No Cost EMI</span>
                    </label>

                    {paymentMethod === 'emi' && (
                      <div className="mt-4 space-y-4 pl-9">
                        {/* EMI Duration */}
                        <div>
                          <label className="block font-bold mb-2">EMI Duration</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[3, 6, 9, 12].map((months) => (
                              <button
                                key={months}
                                onClick={() => {
                                  setEmiDuration(months);
                                  setEmiApprovalStatus(null);
                                  setRiskResult(null);
                                  setEmiError(null);
                                }}
                                className={`p-3 border-2 font-bold ${
                                  emiDuration === months
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-black bg-white'
                                }`}
                              >
                                {months} months
                                <div className="text-sm mt-1">
                                  {formatPrice(calculateEMI(months))}/mo
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Bank Selection */}
                        <div>
                          <label className="block font-bold mb-2">Select Bank</label>
                          <select
                            value={selectedBank}
                            onChange={(e) => {
                              setSelectedBank(e.target.value);
                              setEmiApprovalStatus(null);
                              setRiskResult(null);
                              setEmiError(null);
                            }}
                            className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                          >
                            <option value="">Choose a bank</option>
                            {banks.map((bank) => (
                              <option key={bank} value={bank}>
                                {bank}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* No-Cost EMI Badge */}
                        <div className="p-3 bg-green-100 border-2 border-black">
                          <p className="font-bold text-sm">✅ No Cost EMI - Pay {formatPrice(calculateEMI(emiDuration))}/month for {emiDuration} months</p>
                        </div>

                        {/* EMI Form */}
                        {selectedBank && (
                          <div className="border-3 border-dashed border-black p-4 space-y-4">
                            <h4 className="font-black uppercase">EMI Application Details</h4>
                            
                            <div>
                              <label className="block font-bold mb-2">Payment Method *</label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="cardType"
                                    value="credit"
                                    checked={emiFormData.cardType === 'credit'}
                                    onChange={(e) => {
                                      setEmiFormData({ ...emiFormData, cardType: e.target.value as 'credit' });
                                      setEmiApprovalStatus(null);
                                      setRiskResult(null);
                                      setEmiError(null);
                                    }}
                                  />
                                  <span className="font-semibold">Credit Card</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="cardType"
                                    value="fairlens"
                                    checked={emiFormData.cardType === 'fairlens'}
                                    onChange={(e) => {
                                      setEmiFormData({ ...emiFormData, cardType: e.target.value as 'fairlens' });
                                      setEmiApprovalStatus(null);
                                      setRiskResult(null);
                                      setEmiError(null);
                                    }}
                                  />
                                  <span className="font-semibold">Fairlens</span>
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="block font-bold mb-2">
                                {emiFormData.cardType === 'credit' ? 'Card Last 4 Digits *' : 'Fairlens Account ID *'}
                              </label>
                              <input
                                type="text"
                                value={emiFormData.cardLastFour}
                                onChange={(e) => {
                                  setEmiFormData({ ...emiFormData, cardLastFour: e.target.value.replace(/\D/g, '').slice(0, 4) });
                                  setEmiApprovalStatus(null);
                                  setRiskResult(null);
                                  setEmiError(null);
                                }}
                                placeholder={emiFormData.cardType === 'credit' ? '1234' : 'FL1234'}
                                maxLength={4}
                                className="w-full px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                              />
                            </div>

                            <div>
                                <label className="block font-bold mb-2">Monthly Income (INR) *</label>
                                <input
                                  type="text"
                                  value={emiFormData.monthlyIncome}
                                  onChange={(e) => {
                                    setEmiFormData({ ...emiFormData, monthlyIncome: e.target.value.replace(/\D/g, '') });
                                    setEmiApprovalStatus(null);
                                    setRiskResult(null);
                                    setEmiError(null);
                                  }}
                                  placeholder="50000"
                                  className="w-full px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                                />
                            </div>

                            {/* Bank statement optional for both */}
                            <div>
                              <label className="block font-bold mb-2">Upload Bank Statement (Optional)</label>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setEmiFormData({ ...emiFormData, bankStatement: e.target.files?.[0] || null })}
                                className="w-full px-4 py-3 border-2 border-black font-semibold focus:outline-none focus:shadow-brutal"
                              />
                            </div>

                            <Button
                              onClick={handleEmiApproval}
                              variant="secondary"
                              className="w-full"
                              disabled={emiApprovalStatus === 'pending'}
                            >
                              {emiApprovalStatus === 'pending' ? 'Checking Eligibility...' : 'Check EMI Eligibility'}
                            </Button>

                            {emiApprovalStatus === 'approved' && (
                              <div className="p-4 bg-green-100 border-3 border-green-600 flex items-center gap-3">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                                <div>
                                  <p className="font-black text-green-800">✅ EMI Approved!</p>
                                  <p className="text-sm font-semibold">
                                    Risk Probability: {riskResult ? `${(riskResult.riskProbability * 100).toFixed(2)}%` : 'N/A'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {emiApprovalStatus === 'rejected' && (
                              <div className="p-4 bg-red-100 border-3 border-red-600 flex items-center gap-3">
                                <XCircle className="w-6 h-6 text-red-600" />
                                <div>
                                  <p className="font-black text-red-800">❌ EMI Application Rejected</p>
                                  <p className="text-sm font-semibold">
                                    {emiError
                                      ? 'Risk service unavailable. Please retry in a moment.'
                                      : `Risk Probability: ${riskResult ? `${(riskResult.riskProbability * 100).toFixed(2)}%` : 'N/A'}`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Other Payment Methods */}
                  {[
                    { id: 'card', icon: CreditCard, title: 'Credit/Debit Card' },
                    { id: 'upi', icon: Smartphone, title: 'UPI Payment' },
                    { id: 'wallet', icon: Wallet, title: 'Digital Wallet' },
                    { id: 'cod', icon: Banknote, title: 'Cash on Delivery' },
                  ].map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center gap-3 p-4 border-3 cursor-pointer ${
                        paymentMethod === method.id ? 'border-primary bg-primary/10' : 'border-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <method.icon className="w-6 h-6" />
                      <span className="font-bold">{method.title}</span>
                    </label>
                  ))}

                  <div className="flex gap-4">
                    <Button onClick={() => setCurrentStep(2)} variant="outline" size="lg">
                      Back
                    </Button>
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
                      className="flex-1"
                      size="lg"
                    >
                      Review Order
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review & Place Order */}
            {currentStep === 4 && (
              <div className="border-4 border-black bg-white shadow-brutal">
                <div className="p-6 bg-accent border-b-4 border-black">
                  <h2 className="text-2xl font-black uppercase">Review Your Order</h2>
                </div>
                <div className="p-6 space-y-6">
                  {/* Order Items */}
                  <div>
                    <h3 className="font-black uppercase mb-4">Order Items</h3>
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex gap-4 p-4 border-2 border-black mb-3">
                        <div className="relative w-20 h-20 border-2 border-black">
                          <Image src={item.product.images[0]} alt={item.product.name} fill className="object-cover" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{item.product.name}</p>
                          <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                          <p className="font-bold">{formatPrice(item.product.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Address */}
                  <div>
                    <h3 className="font-black uppercase mb-2">Delivery Address</h3>
                    {addresses.find(a => a.id === selectedAddress) && (
                      <div className="p-4 border-2 border-black">
                        <p className="font-bold">{addresses.find(a => a.id === selectedAddress)?.name}</p>
                        <p className="text-sm">{addresses.find(a => a.id === selectedAddress)?.addressLine1}</p>
                        <p className="text-sm">{addresses.find(a => a.id === selectedAddress)?.city}, {addresses.find(a => a.id === selectedAddress)?.state}</p>
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <h3 className="font-black uppercase mb-2">Payment Method</h3>
                    <div className="p-4 border-2 border-black">
                      <p className="font-bold capitalize">
                        {paymentMethod === 'emi'
                          ? `No Cost EMI - ${emiDuration} months (${selectedBank})`
                          : paymentMethod.replace('_', ' ')}
                      </p>
                      {paymentMethod === 'emi' && (
                        <p className="text-sm text-primary font-semibold mt-1">
                          {formatPrice(calculateEMI(emiDuration))}/month × {emiDuration} months
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button onClick={() => setCurrentStep(3)} variant="outline" size="lg">
                      Back
                    </Button>
                    <Button onClick={handlePlaceOrder} className="flex-1" size="lg">
                      Place Order
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 border-4 border-black bg-white shadow-brutal">
              <div className="p-6 bg-secondary border-b-4 border-black">
                <h2 className="text-2xl font-black uppercase text-white">Order Summary</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between font-semibold">
                  <span>Items ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-primary">
                  <span>Discount</span>
                  <span>- {formatPrice(discount)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Delivery</span>
                  <span>{deliveryCharges === 0 ? 'FREE' : formatPrice(deliveryCharges)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>GST (18%)</span>
                  <span>{formatPrice(gst)}</span>
                </div>
                <div className="border-t-3 border-black pt-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xl font-black uppercase">Total</span>
                    <span className="text-3xl font-black">{formatPrice(total)}</span>
                  </div>
                  {paymentMethod === 'emi' && emiApprovalStatus === 'approved' && (
                    <div className="p-3 bg-primary/10 border-2 border-primary mt-4">
                      <p className="font-bold text-sm">
                        💳 EMI: {formatPrice(calculateEMI(emiDuration))}/month × {emiDuration} months
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EMI Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black shadow-brutal-lg max-w-md w-full p-8 text-center">
            {emiApprovalStatus === 'pending' && (
              <>
                <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                <h3 className="text-2xl font-black uppercase mb-2">Running FairLens Risk Check</h3>
                <p className="font-semibold text-gray-700">
                  Please wait while we evaluate your checkout profile...
                </p>
              </>
            )}
            {emiApprovalStatus === 'approved' && (
              <>
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <h3 className="text-2xl font-black uppercase mb-2 text-green-600">EMI Approved!</h3>
                <p className="font-semibold text-gray-700 mb-4">
                  Decision from {selectedBank}: Approve
                </p>
                <p className="font-semibold text-gray-700 mb-4">
                  Risk Probability: {riskResult ? `${(riskResult.riskProbability * 100).toFixed(2)}%` : 'N/A'}
                </p>
                <Button onClick={() => setShowApprovalModal(false)} className="w-full">
                  Continue
                </Button>
              </>
            )}
            {emiApprovalStatus === 'rejected' && (
              <>
                <XCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
                <h3 className="text-2xl font-black uppercase mb-2 text-red-600">EMI Rejected</h3>
                <p className="font-semibold text-gray-700 mb-4">
                  {emiError
                    ? 'Unable to process FairLens risk check right now. Please try again.'
                    : `Decision from ${selectedBank}: Decline`}
                </p>
                {!emiError && (
                  <p className="font-semibold text-gray-700 mb-4">
                    Risk Probability: {riskResult ? `${(riskResult.riskProbability * 100).toFixed(2)}%` : 'N/A'}
                  </p>
                )}
                <p className="font-semibold text-gray-700 mb-4">
                  Please try another bank or payment method.
                </p>
                <Button onClick={() => {
                  setShowApprovalModal(false);
                  setEmiApprovalStatus(null);
                  setRiskResult(null);
                  setEmiError(null);
                }} className="w-full">
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

