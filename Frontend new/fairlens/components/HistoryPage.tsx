'use client'
import { Card, CardTitle, StatCard, Badge, Btn } from './ui'
import type { Page } from '@/lib/data'

const TIMELINE = [
  { color: '#F59E0B', name: 'Sony Xperia Pro-I – ₹1,09,990',    badge: <Badge variant="warn">Pending Review</Badge>,   sub: 'Case #FL-2024-4821 · Just now · Risk: High (78%)' },
  { color: '#10B981', name: 'Apple MacBook Air M2 – ₹94,900',   badge: <Badge variant="success">Approved</Badge>,      sub: 'Case #FL-2024-4712 · Dec 8, 2024 · Risk: Low (18%)' },
  { color: '#10B981', name: 'Samsung 65" QLED TV – ₹74,990',    badge: <Badge variant="success">Approved</Badge>,      sub: 'Case #FL-2024-4503 · Nov 21, 2024 · Risk: Low (12%)' },
  { color: '#EF4444', name: 'Gaming PC Setup – ₹1,89,000',      badge: <Badge variant="danger">Rejected</Badge>,       sub: 'Case #FL-2024-4201 · Nov 3, 2024 · Risk: High (82%)' },
  { color: '#10B981', name: 'iPhone 15 Pro – ₹1,34,900',        badge: <Badge variant="success">Approved</Badge>,      sub: 'Case #FL-2024-3997 · Oct 14, 2024 · Risk: Low (21%)' },
]

export default function HistoryPage({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[1100px] mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">EMI Request History</div>
          <div className="text-xs text-slate-500 mt-0.5">Track all your past applications</div>
        </div>
        <Btn variant="primary" size="sm" onClick={() => onNav('checkout')}>+ New Application</Btn>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-4">
        <StatCard label="Total Requests" value="8"  sub="All time" />
        <StatCard label="Approved"       value="5"  sub="+2 this month"   valueClass="text-emerald-500" />
        <StatCard label="Pending"        value="2"  sub="Awaiting review" valueClass="text-amber-500" />
        <StatCard label="Rejected"       value="1"  sub="High risk flag"  valueClass="text-red-500" />
      </div>

      <Card className="p-[18px]">
        <CardTitle>Request Timeline</CardTitle>
        {TIMELINE.map((t, i) => (
          <div key={t.sub} className={`flex gap-3 py-3 ${i < TIMELINE.length - 1 ? 'border-b border-slate-200' : ''}`}>
            <div className="w-[9px] h-[9px] rounded-full flex-shrink-0 mt-[3px]" style={{ background: t.color }} />
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold">{t.name}</div>
                {t.badge}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.sub}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
