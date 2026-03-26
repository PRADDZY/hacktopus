'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { fetchAdminAssessments } from '@/lib/fairlensApi';
import { runCheckoutAssessment, toCheckoutErrorMessage } from '@/lib/checkoutAssessment';
import type { PredictionReason, WorkerAssessmentItem } from '@/types';

type AssessmentState = 'idle' | 'running' | 'approved' | 'rejected';

export default function DashboardPage() {
  const [assessments, setAssessments] = useState<WorkerAssessmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'Approve' | 'Decline'>('all');
  const [refreshToken, setRefreshToken] = useState(0);

  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [loanAmount, setLoanAmount] = useState('120000');
  const [tenureMonths, setTenureMonths] = useState(12);
  const [checkState, setCheckState] = useState<AssessmentState>('idle');
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkRisk, setCheckRisk] = useState<number | null>(null);
  const [checkReasons, setCheckReasons] = useState<PredictionReason[]>([]);
  const [checkAssessmentId, setCheckAssessmentId] = useState<string | null>(null);
  const checkApprovalConfidence = checkRisk !== null ? Math.max(0, 1 - checkRisk) : null;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchAdminAssessments(1, 30);
        if (cancelled) {
          return;
        }
        setAssessments(response.items);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load recent actions');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const filteredAssessments = useMemo(
    () =>
      assessments.filter((item) =>
        decisionFilter === 'all' ? true : item.final_decision === decisionFilter
      ),
    [assessments, decisionFilter]
  );

  const resetManagerCheck = () => {
    setCheckState('idle');
    setCheckError(null);
    setCheckRisk(null);
    setCheckReasons([]);
    setCheckAssessmentId(null);
  };

  const handleManagerCheck = async () => {
    if (!statementFile) {
      setCheckError('Upload a bank statement before running the check.');
      return;
    }

    const amount = Number(loanAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCheckError('Enter a valid loan amount.');
      return;
    }

    setCheckState('running');
    setCheckError(null);
    setCheckRisk(null);
    setCheckReasons([]);
    setCheckAssessmentId(null);

    try {
      const result = await runCheckoutAssessment({
        statementFile,
        total: amount,
        emiDuration: tenureMonths
      });

      setCheckAssessmentId(result.assessmentId);
      setCheckRisk(result.riskProbability);
      setCheckReasons(result.reasons ?? []);
      setCheckState(result.decision === 'Approve' ? 'approved' : 'rejected');
      setRefreshToken((value) => value + 1);
    } catch (checkRunError) {
      setCheckError(toCheckoutErrorMessage(checkRunError));
      setCheckState('rejected');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="section-kicker">Bank Dashboard</p>
        <h1 className="section-title">Recent decisions and manager checks</h1>
      </div>

      {error ? (
        <div className="card-subtle p-4 text-sm text-rose-700 border-rose-200/60">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent actions</h2>
            <div className="flex gap-2">
              <select
                className="input-field"
                value={decisionFilter}
                onChange={(event) => setDecisionFilter(event.target.value as 'all' | 'Approve' | 'Decline')}
              >
                <option value="all">All decisions</option>
                <option value="Approve">Approved</option>
                <option value="Decline">Declined</option>
              </select>
              <Button variant="outline" onClick={() => setRefreshToken((value) => value + 1)}>
                Refresh
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-canvas">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-muted uppercase tracking-[0.1em]">Time</th>
                  <th className="px-3 py-2 text-left text-xs text-muted uppercase tracking-[0.1em]">Applicant</th>
                  <th className="px-3 py-2 text-left text-xs text-muted uppercase tracking-[0.1em]">Decision</th>
                  <th className="px-3 py-2 text-left text-xs text-muted uppercase tracking-[0.1em]">Risk %</th>
                  <th className="px-3 py-2 text-left text-xs text-muted uppercase tracking-[0.1em]">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={5}>
                      Loading recent actions...
                    </td>
                  </tr>
                ) : null}
                {!isLoading && filteredAssessments.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={5}>
                      No assessments available.
                    </td>
                  </tr>
                ) : null}
                {!isLoading &&
                  filteredAssessments.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3 text-muted">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-3">{item.owner_sub}</td>
                      <td className="px-3 py-3">{item.final_decision}</td>
                      <td className="px-3 py-3">{(item.risk_probability * 100).toFixed(2)}</td>
                      <td className="px-3 py-3">{item.decision_source}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Manager eligibility checker</h2>
          <p className="text-sm text-muted">
            Run the same statement-based ML check used in checkout.
          </p>

          <input
            type="file"
            accept=".csv,.pdf,.jpg,.jpeg,.png"
            className="input-field"
            onChange={(event) => {
              setStatementFile(event.target.files?.[0] ?? null);
              resetManagerCheck();
            }}
          />
          <input
            className="input-field"
            placeholder="Loan amount (INR)"
            value={loanAmount}
            onChange={(event) => {
              setLoanAmount(event.target.value.replace(/[^\d]/g, ''));
              resetManagerCheck();
            }}
          />
          <select
            className="input-field"
            value={tenureMonths}
            onChange={(event) => {
              setTenureMonths(Number(event.target.value));
              resetManagerCheck();
            }}
          >
            {[3, 6, 9, 12, 18, 24].map((months) => (
              <option key={months} value={months}>
                {months} months
              </option>
            ))}
          </select>

          <Button onClick={() => void handleManagerCheck()} disabled={checkState === 'running'}>
            {checkState === 'running' ? 'Analyzing...' : 'Run eligibility check'}
          </Button>

          {checkState === 'approved' ? (
            <div className="rounded-xl border border-highlight/30 bg-highlight/10 p-3 text-sm text-highlight">
              Approved · ASM-{checkAssessmentId?.slice(0, 8)} · Default Risk (PD){' '}
              {checkRisk !== null ? `${(checkRisk * 100).toFixed(2)}%` : 'N/A'} · Approval Confidence{' '}
              {checkApprovalConfidence !== null ? `${(checkApprovalConfidence * 100).toFixed(2)}%` : 'N/A'}
            </div>
          ) : null}

          {checkState === 'rejected' ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2 text-sm text-rose-700">
              <p>Declined for requested amount/tenure.</p>
              {checkError ? <p>{checkError}</p> : null}
              {checkReasons.length > 0 ? (
                <ul className="space-y-1">
                  {checkReasons.slice(0, 3).map((reason) => (
                    <li key={`${reason.code}-${reason.feature}`}>• {reason.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
