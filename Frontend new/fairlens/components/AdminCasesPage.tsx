'use client'
import { useState } from 'react'
import { Card, Badge, Btn } from './ui'
import { CASES, type Case, type Page } from '@/lib/data'

function riskBadge(risk: Case['risk']) {
  if (risk === 'High')     return <Badge variant="danger">{risk}</Badge>
  if (risk === 'Moderate') return <Badge variant="warn">{risk}</Badge>
  return <Badge variant="success">{risk}</Badge>
}
function statusBadge(s: Case['status']) {
  if (s === 'approved') return <Badge variant="success">Approved</Badge>
  if (s === 'rejected') return <Badge variant="danger">Rejected</Badge>
  return <Badge variant="warn">Pending</Badge>
}

export default function AdminCasesPage({ onNav }: { onNav: (p: Page) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')

  const filtered = CASES.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.product.toLowerCase().includes(q)
    const matchF = !filter || c.status === filter
    return matchQ && matchF
  })

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">Case Management</div>
          <div className="text-xs text-slate-500 mt-0.5">All EMI applications requiring review</div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            <input
              className="pl-7 pr-3 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-xs text-slate-900 bg-white w-[180px] focus:border-navy focus:outline-none font-sans"
              placeholder="Search cases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-2.5 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-[11px] text-slate-900 bg-white focus:border-navy focus:outline-none w-[120px]"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Case ID','Buyer Name','Product','Risk Score','Debt Prob.','Amount','Status','Action'].map(h => (
                <th key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.6px] py-2 px-3 text-left border-b border-slate-200 bg-slate-50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => onNav('admin-case-detail')}
              >
                <td className="py-2.5 px-3 border-b border-slate-200 text-[11px] font-mono">{c.id}</td>
                <td className="py-2.5 px-3 border-b border-slate-200 text-xs font-semibold">{c.name}</td>
                <td className="py-2.5 px-3 border-b border-slate-200 text-xs text-slate-500">{c.product}</td>
                <td className="py-2.5 px-3 border-b border-slate-200">{riskBadge(c.risk)}</td>
                <td className="py-2.5 px-3 border-b border-slate-200 text-xs font-mono font-bold">{c.score}%</td>
                <td className="py-2.5 px-3 border-b border-slate-200 text-xs font-mono">{c.amount}</td>
                <td className="py-2.5 px-3 border-b border-slate-200">{statusBadge(c.status)}</td>
                <td className="py-2.5 px-3 border-b border-slate-200" onClick={e => e.stopPropagation()}>
                  <Btn variant="ghost" size="sm" onClick={() => onNav('admin-case-detail')}>Review →</Btn>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-slate-400">No cases match your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
