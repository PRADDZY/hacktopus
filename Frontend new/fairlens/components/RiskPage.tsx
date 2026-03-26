'use client'
import { useEffect, useState } from 'react'
import { Card, CardTitle, Badge, StatCard, Btn, ProgressBar } from './ui'
import type { Page } from '@/lib/data'

interface Props {
  onNav: (p: Page) => void
  onOpenHRModal: () => void
}

const BARS = [
  { label: 'Debt-to-Income Ratio',  pct: 78, color: '#EF4444' },
  { label: 'Credit Score Strength', pct: 70, color: '#10B981' },
  { label: 'Expense Burden',        pct: 49, color: '#EF4444' },
  { label: 'Savings Buffer',        pct: 100, color: '#10B981' },
]

export default function RiskPage({ onNav, onOpenHRModal }: Props) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150)
    return () => clearTimeout(t)
  }, [])

  const pct = 78
  // Gauge arc: semicircle, 251 total dasharray length
  const fill = animated ? Math.round(251 * pct / 100) : 0
  const needleAngle = animated ? -90 + (pct / 100) * 180 : -90

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[860px] mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">Risk Assessment Report</div>
          <div className="text-xs text-slate-500 mt-0.5">Case #FL-2024-4821 · Generated just now</div>
        </div>
        <Badge variant="danger" className="text-[11px] px-3 py-1">High Risk</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-3.5">
        {/* Gauge */}
        <Card className="flex flex-col items-center p-6">
          <CardTitle>Debt Trap Probability</CardTitle>
          <svg width="190" height="105" viewBox="0 0 200 110">
            <defs>
              <linearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#10B981" />
                <stop offset="50%"  stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
            </defs>
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E2E8F0" strokeWidth="13" strokeLinecap="round" />
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#gg)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={`${fill} 251`}
              style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
            />
            <line
              x1="100" y1="100" x2="100" y2="30"
              stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round"
              style={{
                transformOrigin: '100px 100px',
                transform: `rotate(${needleAngle}deg)`,
                transition: 'transform 1s cubic-bezier(.4,0,.2,1)',
              }}
            />
            <circle cx="100" cy="100" r="5" fill="#0F172A" />
            <text x="18" y="116" fontSize="8" fill="#94A3B8" fontFamily="DM Mono,monospace">0%</text>
            <text x="173" y="116" fontSize="8" fill="#94A3B8" fontFamily="DM Mono,monospace">100%</text>
          </svg>
          <div className="font-mono text-[28px] font-bold text-center mt-1">78%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Probability of Debt Trap</div>
        </Card>

        {/* Risk Breakdown */}
        <Card className="p-[18px]">
          <CardTitle>Risk Breakdown</CardTitle>
          <div className="flex flex-col gap-2.5">
            {BARS.map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-500">{b.label}</span>
                  <span className="font-mono font-bold" style={{ color: b.color }}>{b.pct}%</span>
                </div>
                <ProgressBar pct={animated ? b.pct : 0} color={b.color} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-3.5 mb-3.5">
        <StatCard label="Credit Score"   value="720"    sub="Good" />
        <StatCard label="Monthly Income" value="₹85K"   sub="Gross monthly" />
        <StatCard label="EMI Burden"     value="14%"    sub="After new EMI" valueClass="text-red-500" />
        <StatCard label="Savings Buffer" value="₹220K"  sub="Emergency fund" />
      </div>

      {/* Recommendations */}
      <Card className="p-[18px] mb-3.5">
        <CardTitle>AI Recommendations</CardTitle>
        <div className="flex flex-col gap-1.5">
          <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">🚩 Your DTI will exceed 40% after this EMI. Consider reducing existing loans first.</div>
          <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">⚠️ Your expense-to-income ratio is elevated. Building a larger savings buffer is recommended.</div>
          <div className="px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-[11px] text-green-800">✓ Your credit score is healthy. Maintain timely payments to keep it strong.</div>
        </div>
      </Card>

      {/* Decision */}
      <Card className="p-[18px]">
        <CardTitle>Decision</CardTitle>
        <div className="flex items-center justify-between gap-3.5 p-3.5 rounded-xl bg-red-50 border border-red-200">
          <div>
            <div className="font-bold text-red-800 mb-0.5">⚠ High Risk – Manual Review Required</div>
            <div className="text-[11px] text-red-700">This application cannot be auto-approved. It will be submitted for bank review.</div>
          </div>
          <Btn variant="primary" size="sm" className="flex-shrink-0" onClick={onOpenHRModal}>Submit for Review →</Btn>
        </div>
      </Card>
    </div>
  )
}
