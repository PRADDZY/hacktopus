'use client'
import type { Page } from '@/lib/data'

interface Props {
  current: Page
  onNav: (p: Page) => void
  onLogout: () => void
}

export default function AdminSidebar({ current, onNav, onLogout }: Props) {
  const sl = (page: Page, icon: string, label: string, badge?: string) => (
    <button
      onClick={() => onNav(page)}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all w-full text-left cursor-pointer border-none font-sans ${
        current === page ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span>{icon}</span>
      {label}
      {badge && (
        <span className="ml-auto bg-accent text-navy text-[8px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
      )}
    </button>
  )

  return (
    <div className="w-[200px] bg-navy flex flex-col p-3 gap-0.5 flex-shrink-0">
      <div className="text-[9px] font-bold text-white/30 uppercase tracking-[0.8px] px-2.5 py-2">Overview</div>
      {sl('admin-dashboard', '📊', 'Dashboard')}
      {sl('admin-cases', '📋', 'Cases', '14')}
      <div className="mt-auto pt-3 border-t border-white/[0.08] flex flex-col gap-0.5">
        <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white w-full text-left cursor-pointer border-none font-sans">
          <span>⚙️</span> Settings
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white w-full text-left cursor-pointer border-none font-sans"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </div>
  )
}
