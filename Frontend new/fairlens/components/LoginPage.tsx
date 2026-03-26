'use client'
import { useState } from 'react'
import { Btn, Input } from './ui'
import type { Role } from '@/lib/data'

interface Props {
  onLogin: (role: Role) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [role, setRole] = useState<Role>('user')

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0A2540,#1A3A5C)' }}>
      <div className="bg-white rounded-[20px] p-8 w-[380px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* Logo */}
        <div className="font-display text-[22px] font-extrabold text-center text-navy mb-0.5">
          Fair<span className="text-accent">Lens</span>
        </div>
        <div className="text-center text-[11px] text-slate-400 font-medium mb-5">EMI Risk Intelligence Platform</div>

        {/* Role selector */}
        <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-slate-400 text-center mb-3">Select Account Type</div>
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {([['user','👤','Customer','Apply for EMI'],['admin','🏦','Bank Admin','Review & Manage']] as const).map(([r,icon,title,sub]) => (
            <div
              key={r}
              onClick={() => setRole(r)}
              className="rounded-xl p-3.5 text-center cursor-pointer border-2 transition-all"
              style={{
                borderColor: role === r ? '#00F5C4' : '#E2E8F0',
                background:  role === r ? 'rgba(0,245,196,0.08)' : 'transparent',
              }}
            >
              <div className="text-[22px] mb-1.5">{icon}</div>
              <div className="text-xs font-bold text-slate-900">{title}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <Input label="Email Address" type="email" defaultValue={role === 'admin' ? 'admin@hdfc.com' : 'user@fairlens.io'} key={role} />
        </div>
        <div className="mb-4">
          <Input label="Password" type="password" defaultValue="••••••••" />
        </div>

        <Btn variant="primary" size="lg" className="w-full justify-center" onClick={() => onLogin(role)}>
          Sign In →
        </Btn>
        <div className="text-center mt-3 text-[10px] text-slate-400">Protected by FairLens AI Risk Engine v2.4</div>
      </div>
    </div>
  )
}
