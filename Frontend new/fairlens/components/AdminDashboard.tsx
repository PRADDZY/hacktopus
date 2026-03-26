'use client'
import { useEffect, useRef } from 'react'
import { Card, CardTitle, StatCard, Badge, Btn } from './ui'
import type { Page } from '@/lib/data'

export default function AdminDashboard({ onNav }: { onNav: (p: Page) => void }) {
  const doughnutRef = useRef<HTMLCanvasElement>(null)
  const barRef      = useRef<HTMLCanvasElement>(null)
  const riskRef     = useRef<HTMLCanvasElement>(null)
  const chartsRef   = useRef<any[]>([])

  useEffect(() => {
    let Chart: any
    import('chart.js').then(mod => {
      Chart = mod.Chart
      mod.Chart.register(...mod.registerables)

      // destroy old
      chartsRef.current.forEach(c => c.destroy())
      chartsRef.current = []

      if (doughnutRef.current) {
        chartsRef.current.push(new Chart(doughnutRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Approved', 'Pending', 'Rejected'],
            datasets: [{ data: [89, 31, 22], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderWidth: 0, hoverOffset: 3 }],
          },
          options: { cutout: '72%', plugins: { legend: { display: false } }, maintainAspectRatio: false },
        }))
      }

      if (barRef.current) {
        chartsRef.current.push(new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
              { label: 'Approved', data: [18, 22, 16, 25, 28, 21], backgroundColor: '#10B981', borderRadius: 4, borderSkipped: false },
              { label: 'Rejected', data: [4, 3, 6, 4, 5, 4],       backgroundColor: '#EF4444', borderRadius: 4, borderSkipped: false },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 9 } } },
            scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 } } } },
            barPercentage: 0.6, categoryPercentage: 0.7,
          },
        }))
      }

      if (riskRef.current) {
        chartsRef.current.push(new Chart(riskRef.current, {
          type: 'bar',
          data: {
            labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
            datasets: [{ data: [38, 27, 22, 18, 8], backgroundColor: ['#10B981', '#34D399', '#F59E0B', '#F87171', '#EF4444'], borderRadius: 5, borderSkipped: false }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 9 } } } },
          },
        }))
      }
    })

    return () => { chartsRef.current.forEach(c => c.destroy()); chartsRef.current = [] }
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">Dashboard Overview</div>
          <div className="text-xs text-slate-500 mt-0.5">HDFC Bank · FairLens Risk Engine · Last updated just now</div>
        </div>
        <div className="flex gap-2">
          <select className="px-2.5 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-[11px] text-slate-900 bg-white focus:border-navy focus:outline-none">
            <option>This Month</option><option>Last 30 days</option><option>Q4 2024</option>
          </select>
          <Btn variant="primary" size="sm">Export Report</Btn>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-4">
        <StatCard label="Total Cases" value="142" sub="↑ 12% this month" />
        <StatCard label="Approved"    value="89"  sub="62.7% approval rate" valueClass="text-emerald-500" />
        <StatCard label="Pending"     value="31"  sub="Avg. 1.4 days"       valueClass="text-amber-500" />
        <StatCard label="Rejected"    value="22"  sub="High risk flags"     valueClass="text-red-500" />
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-3.5">
        {/* Doughnut */}
        <Card className="p-[18px]">
          <CardTitle>EMI Approved vs Rejected</CardTitle>
          <div className="h-[200px] relative flex items-center justify-center">
            <canvas ref={doughnutRef} style={{ maxHeight: 200 }} />
            <div className="absolute text-center pointer-events-none">
              <div className="font-mono text-[20px] font-bold">62.7%</div>
              <div className="text-[10px] text-slate-400">Approval Rate</div>
            </div>
          </div>
          <div className="flex gap-3.5 mt-2 justify-center">
            {[['#10B981','Approved (89)'],['#F59E0B','Pending (31)'],['#EF4444','Rejected (22)']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className="w-[7px] h-[7px] rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Bar */}
        <Card className="p-[18px]">
          <CardTitle>Monthly Approvals vs Rejections</CardTitle>
          <div className="h-[200px]"><canvas ref={barRef} /></div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* Risk dist */}
        <Card className="p-[18px]">
          <CardTitle>Risk Score Distribution</CardTitle>
          <div className="h-[160px]"><canvas ref={riskRef} /></div>
        </Card>

        {/* Recent cases */}
        <Card className="p-[18px]">
          <CardTitle>Recent Cases</CardTitle>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Buyer','Risk','Status'].map(h => (
                  <th key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.6px] py-2 px-3 text-left border-b border-slate-200 bg-slate-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Aarav Rao',   'FL-2024-4821', <Badge variant="danger">High 78%</Badge>,  <Badge variant="warn">Pending</Badge>],
                ['Priya Mehta', 'FL-2024-4818', <Badge variant="warn">Mod 44%</Badge>,     <Badge variant="warn">Review</Badge>],
                ['Rohan Singh', 'FL-2024-4810', <Badge variant="success">Low 12%</Badge>,  <Badge variant="success">Approved</Badge>],
                ['Kavya Iyer',  'FL-2024-4802', <Badge variant="danger">High 71%</Badge>,  <Badge variant="danger">Rejected</Badge>],
              ].map(([name, id, risk, status]) => (
                <tr key={id as string} className="cursor-pointer hover:bg-slate-50" onClick={() => onNav('admin-case-detail')}>
                  <td className="py-2.5 px-3 border-b border-slate-200 text-xs">
                    <strong>{name as string}</strong>
                    <div className="text-[10px] text-slate-400">{id as string}</div>
                  </td>
                  <td className="py-2.5 px-3 border-b border-slate-200 text-xs">{risk as React.ReactNode}</td>
                  <td className="py-2.5 px-3 border-b border-slate-200 text-xs">{status as React.ReactNode}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2.5 text-right">
            <Btn variant="ghost" size="sm" onClick={() => onNav('admin-cases')}>View All →</Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}
