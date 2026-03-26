'use client'
import { Card, CardTitle, Badge, Btn, ProgressBar } from './ui'
import type { Page } from '@/lib/data'

interface Props {
  onNav: (p: Page) => void
  onOpenOverride: () => void
  onApprove: () => void
  onReject: () => void
}

const RISK_BARS = [
  { label: 'DTI Risk',          pct: 78, color: '#EF4444' },
  { label: 'Income Adequacy',   pct: 52, color: '#F59E0B' },
  { label: 'Savings Coverage',  pct: 67, color: '#10B981' },
  { label: 'Payment History',   pct: 85, color: '#10B981' },
]

export default function AdminCaseDetail({ onNav, onOpenOverride, onApprove, onReject }: Props) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 pb-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-3 text-[11px] text-slate-400">
          <span className="cursor-pointer text-slate-500 hover:underline" onClick={() => onNav('admin-cases')}>Cases</span>
          <span>›</span>
          <span className="text-slate-900 font-semibold">FL-2024-4821 · Aarav Rao</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-bold tracking-[-0.5px]">Case Detail: FL-2024-4821</div>
            <div className="text-xs text-slate-500 mt-0.5">Dec 10, 2024 · Sony Xperia Pro-I · ₹1,09,990</div>
          </div>
          <Badge variant="danger" className="text-[11px] px-3 py-1">⚠ High Risk</Badge>
        </div>

        <div className="grid grid-cols-2 gap-[18px]">
          {/* Left column */}
          <div>
            {/* Customer Profile */}
            <Card className="p-[18px] mb-3.5">
              <CardTitle>Customer Profile</CardTitle>
              <div className="flex gap-2.5 mb-3.5 items-center">
                <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-accent font-display text-base font-extrabold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#0A2540,#1A3A5C)' }}>AR</div>
                <div>
                  <div className="text-sm font-bold">Aarav Rao</div>
                  <div className="text-[11px] text-slate-400">aarav.rao@email.com · +91 98765 43210</div>
                </div>
              </div>
              {[
                ['Date of Birth', 'Mar 15, 1990 (34 yrs)'],
                ['Occupation',    'Software Engineer'],
                ['Employer',      'Infosys Ltd.'],
                ['City',          'Pune, MH'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <span className="text-[11px] font-semibold text-slate-500">{k}</span>
                  <span className="font-mono text-xs font-bold">{v}</span>
                </div>
              ))}
            </Card>

            {/* Income Summary */}
            <Card className="p-[18px]">
              <CardTitle>Income &amp; Financial Summary</CardTitle>
              {[
                ['Monthly Income',   '₹85,000',    'text-emerald-500'],
                ['Monthly Expenses', '₹42,000',    ''],
                ['Existing EMIs',    '₹8,500/mo',  'text-amber-500'],
                ['Total EMI After',  '₹12,167/mo', 'text-red-500'],
                ['DTI Ratio',        '28% → 42%',  'text-red-500'],
              ].map(([k, v, cls]) => (
                <div key={k} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <span className="text-[11px] font-semibold text-slate-500">{k}</span>
                  <span className={`font-mono text-xs font-bold ${cls}`}>{v}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Right column */}
          <div>
            {/* Risk Analysis */}
            <Card className="p-[18px] mb-3.5">
              <CardTitle>Risk Analysis</CardTitle>
              <div className="flex items-center gap-4 mb-3.5">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-slate-400 mb-0.5">Debt Trap Score</div>
                  <div className="font-mono text-[30px] font-bold text-red-500">78%</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-slate-400 mb-0.5">Credit Score</div>
                  <div className="font-mono text-[30px] font-bold text-amber-500">720</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-slate-400 mb-0.5">Risk Level</div>
                  <Badge variant="danger" className="text-xs px-3 py-1">HIGH</Badge>
                </div>
              </div>
              {RISK_BARS.map(b => (
                <div key={b.label} className="mb-2">
                  <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                    <span className="text-slate-500">{b.label}</span>
                    <span className="font-mono" style={{ color: b.color }}>{b.pct}%</span>
                  </div>
                  <ProgressBar pct={b.pct} color={b.color} />
                </div>
              ))}
            </Card>

            {/* AI Flags */}
            <Card className="p-[18px] mb-3.5">
              <CardTitle>AI Risk Flags</CardTitle>
              <div className="flex flex-col gap-1.5">
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">🚩 <strong>DTI will exceed 40% threshold</strong> after new EMI</div>
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">🚩 <strong>3 existing active EMIs</strong> detected in bank statement</div>
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">⚠️ <strong>Savings buffer below 3-month threshold</strong></div>
                <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-[11px] text-green-800">✓ <strong>Clean payment history</strong> – no defaults in last 24 months</div>
              </div>
            </Card>

            {/* Bank Statement Summary */}
            <Card className="p-[18px]">
              <CardTitle>Bank Statement Summary</CardTitle>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ['Avg. Monthly Credit', '₹87,200'],
                  ['Avg. Monthly Debit',  '₹71,400'],
                  ['Closing Balance',     '₹2,22,800'],
                  ['EMI Transactions',    '3 active'],
                ].map(([l, v]) => (
                  <div key={l} className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="text-[10px] text-slate-400">{l}</div>
                    <div className="font-mono font-bold mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Decision Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3 shadow-[0_-3px_12px_rgba(0,0,0,0.05)] flex-shrink-0">
        <div>
          <strong className="text-xs block mb-0.5">Case FL-2024-4821 · Aarav Rao</strong>
          <span className="text-[11px] text-slate-500">Sony Xperia Pro-I · ₹1,09,990 · Risk: 78% High · Awaiting review</span>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost"   size="sm" onClick={() => onNav('admin-cases')}>← Back</Btn>
          <Btn variant="ghost"   size="sm" onClick={onOpenOverride}>⚡ Override</Btn>
          <Btn variant="danger"  size="sm" onClick={onReject}>✕ Reject</Btn>
          <Btn variant="success" size="sm" onClick={onApprove}>✓ Approve</Btn>
        </div>
      </div>
    </div>
  )
}
