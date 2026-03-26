'use client'
import { Btn } from './ui'
import type { Page } from '@/lib/data'

const LINKS: { id: Page; label: string }[] = [
  { id: 'checkout', label: '🛒 Shop' },
  { id: 'upload',   label: '📤 Upload' },
  { id: 'risk',     label: '📊 Risk Report' },
  { id: 'history',  label: '🗂 History' },
  { id: 'support',  label: '💬 Support' },
]

export default function BuyerNav({ current, onNav, onLogout }: { current: Page; onNav: (p: Page) => void; onLogout: () => void }) {
  return (
    <nav className="bg-navy text-white h-[52px] flex items-center justify-between px-6 flex-shrink-0">
      <div className="font-display text-[17px] font-extrabold tracking-[-0.5px]">Fair<span className="text-accent">Lens</span></div>
      <div className="flex gap-0.5">
        {LINKS.map(l => (
          <button
            key={l.id}
            onClick={() => onNav(l.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border-none ${
              current === l.id ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-accent flex items-center justify-center text-navy font-bold text-[11px]">AR</div>
        <button onClick={onLogout} className="px-3 py-1.5 rounded-md bg-white/[0.08] text-white/70 text-[11px] cursor-pointer border-none hover:bg-white/20">Logout</button>
      </div>
    </nav>
  )
}
