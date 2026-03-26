'use client'
import { Card, Badge, Chip, StatCard } from './ui'
import type { Page } from '@/lib/data'

export default function CheckoutPage({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[1100px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">Product Details</div>
          <div className="text-xs text-slate-500 mt-0.5">FairLens-powered checkout experience</div>
        </div>
        <div className="flex gap-2">
          <Chip>🛍 Electronics</Chip>
          <Chip>Free Delivery</Chip>
        </div>
      </div>

      {/* Product Card */}
      <Card className="p-6 mb-4">
        <div className="flex gap-6">
          <div className="w-[280px] h-[220px] rounded-2xl flex-shrink-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)' }}>
            <div className="text-center text-white/90">
              <div className="text-[52px] mb-1.5">📱</div>
              <div className="text-[11px] font-semibold opacity-80">Sony Xperia Pro-I</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[1px] mb-1">Sony Electronics</div>
            <div className="text-[22px] font-bold tracking-[-0.5px] mb-1.5">Sony Xperia Pro-I<br />256GB / Frosted Black</div>
            <div className="text-amber-500 text-[11px] mb-3">★★★★☆ <span className="text-slate-400">4.3 (1,248 reviews)</span></div>
            <div className="font-mono text-[26px] font-bold tracking-[-1px] mb-0.5">₹1,09,990</div>
            <div className="text-xs text-slate-500 mb-3">Starting from <strong className="text-emerald-600">₹3,667/mo</strong> for 36 months | 0% interest for 12 months</div>
            <div className="flex gap-1.5 flex-wrap mb-3">
              <Badge variant="success">In Stock</Badge>
              <Badge variant="info">EMI Available</Badge>
              <Badge variant="accent">FairLens Partner</Badge>
            </div>
            <hr className="border-slate-200 my-3" />
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {[['Processor','Snapdragon 888'],['Camera','12MP 1" Sensor'],['Battery','4500 mAh']].map(([l,v]) => (
                <div key={l} className="bg-white border border-slate-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.6px] mb-1">{l}</div>
                  <div className="text-[11px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3.5 flex items-center justify-between gap-3"
              style={{ background: 'linear-gradient(135deg,#0A2540,#1A3A5C)' }}>
              <div>
                <div className="text-[13px] font-bold text-white mb-0.5">🔍 Check EMI Risk with FairLens</div>
                <div className="text-[11px] text-white/70">Upload bank statement for instant AI risk assessment</div>
              </div>
              <button
                onClick={() => onNav('upload')}
                className="px-5 py-2.5 rounded-[10px] bg-accent text-navy font-bold text-[13px] flex-shrink-0 cursor-pointer border-none hover:opacity-90 transition-opacity"
              >
                Check Eligibility →
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Similar products */}
      <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-slate-400 mb-2.5">Similar Products</div>
      <div className="grid grid-cols-4 gap-3">
        {[
          ['📱','iPhone 15 Pro','₹1,34,900','₹4,497','linear-gradient(135deg,#f093fb,#f5576c)'],
          ['💻','MacBook Air M3','₹1,14,990','₹3,833','linear-gradient(135deg,#4facfe,#00f2fe)'],
          ['📱','Samsung S24 Ultra','₹1,29,999','₹4,333','linear-gradient(135deg,#43e97b,#38f9d7)'],
          ['📟','iPad Pro M4','₹1,09,900','₹3,663','linear-gradient(135deg,#fa709a,#fee140)'],
        ].map(([icon,name,price,emi,bg]) => (
          <Card key={name} className="p-3.5 cursor-pointer hover:shadow-md transition-shadow">
            <div className="h-[70px] rounded-lg flex items-center justify-center text-[28px] mb-2.5" style={{ background: bg as string }}>{icon}</div>
            <div className="text-[11px] font-semibold">{name}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{price}</div>
            <Badge variant="info" className="mt-1.5">EMI from {emi}</Badge>
          </Card>
        ))}
      </div>
    </div>
  )
}
