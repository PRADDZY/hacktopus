'use client'
import { useState, useCallback } from 'react'
import type { Page, Role } from '@/lib/data'

import { ToastContainer, type ToastItem, type ToastType } from './ui'
import LoginPage         from './LoginPage'
import BuyerNav          from './BuyerNav'
import AdminSidebar      from './AdminSidebar'
import CheckoutPage      from './CheckoutPage'
import UploadPage        from './UploadPage'
import RiskPage          from './RiskPage'
import HistoryPage       from './HistoryPage'
import SupportPage       from './SupportPage'
import AdminDashboard    from './AdminDashboard'
import AdminCasesPage    from './AdminCasesPage'
import AdminCaseDetail   from './AdminCaseDetail'
import { HRModal, OverrideModal } from './Modals'

let toastId = 0

export default function FairLensApp() {
  const [page, setPage] = useState<Page>('login')
  const [role, setRole] = useState<Role>('user')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [hrModal, setHrModal] = useState(false)
  const [ovModal, setOvModal] = useState(false)

  function toast(msg: string, type: ToastType = 'info') {
    const id = toastId++
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  function handleLogin(r: Role) {
    setRole(r)
    setPage(r === 'admin' ? 'admin-dashboard' : 'checkout')
  }

  function handleLogout() {
    setPage('login')
    setRole('user')
  }

  const nav = useCallback((p: Page) => setPage(p), [])

  const isAdmin = role === 'admin'

  return (
    <div className="flex flex-col h-screen min-h-[600px] relative">
      {/* Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Modals */}
      <HRModal
        show={hrModal}
        onClose={() => setHrModal(false)}
        onSubmit={() => {
          setHrModal(false)
          toast('Case submitted for bank review. Case #FL-2024-4821', 'warn')
          setPage('history')
        }}
      />
      <OverrideModal
        show={ovModal}
        onClose={() => setOvModal(false)}
        onConfirm={() => {
          setOvModal(false)
          toast('⚡ Manual override applied successfully', 'warn')
        }}
      />

      {/* LOGIN */}
      {page === 'login' && (
        <div className="flex flex-col flex-1">
          <LoginPage onLogin={handleLogin} />
        </div>
      )}

      {/* BUYER PAGES */}
      {!isAdmin && page !== 'login' && (
        <>
          <BuyerNav current={page} onNav={nav} onLogout={handleLogout} />
          <div className="flex flex-col flex-1 overflow-hidden">
            {page === 'checkout' && <CheckoutPage onNav={nav} />}
            {page === 'upload'   && <UploadPage   onNav={nav} />}
            {page === 'risk'     && <RiskPage     onNav={nav} onOpenHRModal={() => setHrModal(true)} />}
            {page === 'history'  && <HistoryPage  onNav={nav} />}
            {page === 'support'  && <SupportPage />}
          </div>
        </>
      )}

      {/* ADMIN PAGES */}
      {isAdmin && page !== 'login' && (
        <>
          {/* Admin top nav */}
          <nav className="bg-navy text-white h-[52px] flex items-center justify-between px-6 flex-shrink-0">
            <div className="font-display text-[17px] font-extrabold tracking-[-0.5px]">
              Fair<span className="text-accent">Lens</span>
              <span className="ml-2 bg-accent text-navy text-[9px] font-bold px-1.5 py-0.5 rounded-full">ADMIN</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-[30px] h-[30px] rounded-full bg-amber-400 flex items-center justify-center text-navy font-bold text-[11px]">BA</div>
              <span className="text-[11px] text-white/60">Bank Admin · HDFC</span>
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-md bg-white/[0.08] text-white/70 text-[11px] cursor-pointer border-none hover:bg-white/20">Logout</button>
            </div>
          </nav>

          {/* Admin layout: sidebar + content */}
          <div className="flex flex-1 overflow-hidden">
            <AdminSidebar current={page} onNav={nav} onLogout={handleLogout} />
            <div className="flex flex-col flex-1 overflow-hidden">
              {page === 'admin-dashboard'   && <AdminDashboard  onNav={nav} />}
              {page === 'admin-cases'       && <AdminCasesPage  onNav={nav} />}
              {page === 'admin-case-detail' && (
                <AdminCaseDetail
                  onNav={nav}
                  onOpenOverride={() => setOvModal(true)}
                  onApprove={() => { toast('✅ Case FL-2024-4821 approved!', 'success'); setTimeout(() => nav('admin-cases'), 1200) }}
                  onReject={() => { toast('Case FL-2024-4821 rejected.', 'danger');  setTimeout(() => nav('admin-cases'), 1200) }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
