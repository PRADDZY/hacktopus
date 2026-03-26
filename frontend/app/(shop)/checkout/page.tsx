'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { runCheckoutAssessment, toCheckoutErrorMessage } from '@/lib/checkoutAssessment';
import { formatCurrency } from '@/lib/format';
import { product } from '@/data/product';
import type { PredictionReason } from '@/types';

type PaymentMethod = 'debit' | 'fairlens';
type AssessmentState = 'idle' | 'running' | 'approved' | 'rejected';

export default function CheckoutPage() {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('fairlens');
  const [showFairlensModal, setShowFairlensModal] = useState(false);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [tenureMonths, setTenureMonths] = useState(12);
  const [loanAmount, setLoanAmount] = useState(String(product.price));
  const [assessmentState, setAssessmentState] = useState<AssessmentState>('idle');
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [riskProbability, setRiskProbability] = useState<number | null>(null);
  const [reasonList, setReasonList] = useState<PredictionReason[]>([]);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(loanAmount);
  const approvalConfidence = riskProbability !== null ? Math.max(0, 1 - riskProbability) : null;

  const resetAssessment = () => {
    setAssessmentState('idle');
    setAssessmentId(null);
    setRiskProbability(null);
    setReasonList([]);
    setError(null);
  };

  const handleDebitCheckout = () => {
    router.push('/checkout/success?method=debit');
  };

  const handleRunFairlens = async () => {
    if (!statementFile) {
      setError('Please upload a bank statement.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid loan amount.');
      return;
    }

    setAssessmentState('running');
    setError(null);
    setReasonList([]);
    setAssessmentId(null);
    setRiskProbability(null);

    try {
      const result = await runCheckoutAssessment({
        statementFile,
        total: amount,
        emiDuration: tenureMonths
      });

      setAssessmentId(result.assessmentId);
      setRiskProbability(result.riskProbability);
      setReasonList(result.reasons ?? []);
      if (result.decision === 'Approve') {
        setAssessmentState('approved');
      } else {
        setAssessmentState('rejected');
      }
    } catch (assessmentError) {
      setError(toCheckoutErrorMessage(assessmentError));
      setAssessmentState('rejected');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="section-kicker">Checkout</p>
        <h1 className="section-title">Complete your purchase</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-6 space-y-5">
          <div className="flex gap-4">
            <div className="relative h-24 w-32 overflow-hidden rounded-xl">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{product.brand}</p>
              <h2 className="text-xl font-semibold">{product.name}</h2>
              <p className="text-sm text-muted mt-1">{formatCurrency(product.price)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Choose payment path</p>
            <label className={`block rounded-xl border p-4 ${paymentMethod === 'debit' ? 'border-accent bg-accent/5' : 'border-line'}`}>
              <input
                type="radio"
                name="payment"
                value="debit"
                checked={paymentMethod === 'debit'}
                onChange={() => {
                  setPaymentMethod('debit');
                  resetAssessment();
                }}
                className="mr-2"
              />
              Pay with Debit Card
            </label>
            <label className={`block rounded-xl border p-4 ${paymentMethod === 'fairlens' ? 'border-accent bg-accent/5' : 'border-line'}`}>
              <input
                type="radio"
                name="payment"
                value="fairlens"
                checked={paymentMethod === 'fairlens'}
                onChange={() => {
                  setPaymentMethod('fairlens');
                  resetAssessment();
                }}
                className="mr-2"
              />
              Proceed with FairLens
            </label>
          </div>

          {paymentMethod === 'debit' ? (
            <Button onClick={handleDebitCheckout}>Place order</Button>
          ) : (
            <Button onClick={() => setShowFairlensModal(true)}>Start FairLens check</Button>
          )}
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold">Order summary</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Item</span>
            <span className="font-semibold">{formatCurrency(product.price)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Delivery</span>
            <span className="font-semibold">Free</span>
          </div>
          <div className="border-t border-line pt-4 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(product.price)}</span>
          </div>
          {assessmentState === 'approved' ? (
            <div className="rounded-xl border border-highlight/30 bg-highlight/10 p-3 text-sm text-highlight">
              FairLens approved. Continue to place order.
            </div>
          ) : null}
          {assessmentState === 'rejected' ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              FairLens check failed. Review reason details in the popup.
            </div>
          ) : null}
        </div>
      </div>

      {showFairlensModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-lg w-full p-6 space-y-4">
            <div>
              <p className="section-kicker">FairLens Credit Check</p>
              <h2 className="text-xl font-semibold">Upload bank statement</h2>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                accept=".csv,.pdf,.jpg,.jpeg,.png"
                className="input-field"
                onChange={(event) => {
                  setStatementFile(event.target.files?.[0] ?? null);
                  resetAssessment();
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input-field"
                  placeholder="Loan amount (INR)"
                  value={loanAmount}
                  onChange={(event) => {
                    setLoanAmount(event.target.value.replace(/[^\d]/g, ''));
                    resetAssessment();
                  }}
                />
                <select
                  value={tenureMonths}
                  onChange={(event) => {
                    setTenureMonths(Number(event.target.value));
                    resetAssessment();
                  }}
                  className="input-field"
                >
                  {[3, 6, 9, 12, 18, 24].map((months) => (
                    <option key={months} value={months}>
                      {months} months
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted">
                Supported files: CSV, PDF, JPG, PNG.
              </p>
            </div>

            {assessmentState === 'running' ? (
              <div className="rounded-xl border border-line p-4 text-sm text-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running FairLens analysis...
              </div>
            ) : null}

            {assessmentState === 'approved' ? (
              <div className="rounded-xl border border-highlight/30 bg-highlight/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-highlight font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Credit check passed
                </div>
                <p className="text-sm text-muted">
                  Assessment ID: {assessmentId ? `ASM-${assessmentId.slice(0, 8)}` : 'N/A'}
                </p>
                <p className="text-sm text-muted">
                  Default Risk (PD): {riskProbability !== null ? `${(riskProbability * 100).toFixed(2)}%` : 'N/A'}
                </p>
                <p className="text-sm text-muted">
                  Approval Confidence: {approvalConfidence !== null ? `${(approvalConfidence * 100).toFixed(2)}%` : 'N/A'}
                </p>
              </div>
            ) : null}

            {assessmentState === 'rejected' ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 font-semibold">
                  <XCircle className="h-5 w-5" />
                  Credit check failed
                </div>
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                {reasonList.length > 0 ? (
                  <ul className="space-y-2 text-sm text-rose-700">
                    {reasonList.slice(0, 3).map((reason) => (
                      <li key={`${reason.code}-${reason.feature}`}>• {reason.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFairlensModal(false);
                  resetAssessment();
                }}
              >
                Close
              </Button>

              {assessmentState === 'approved' ? (
                <Button onClick={() => router.push(`/checkout/success?method=fairlens&assessment=${assessmentId ?? ''}`)}>
                  Continue to checkout
                </Button>
              ) : (
                <Button
                  onClick={() => void handleRunFairlens()}
                  disabled={assessmentState === 'running'}
                >
                  Analyze statement
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
