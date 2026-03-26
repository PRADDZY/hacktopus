'use client'
import React from 'react'
import { clsx } from 'clsx'   // We'll inline a tiny clsx replacement

// Tiny cx helper (no dependency needed)
export function cx(...args: (string | undefined | false | null)[]) {
  return args.filter(Boolean).join(' ')
}

// ── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warn' | 'danger' | 'info' | 'accent'
const badgeStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700',
  warn:    'bg-amber-100 text-amber-700',
  danger:  'bg-red-100   text-red-700',
  info:    'bg-blue-100  text-blue-700',
  accent:  'bg-[rgba(0,245,196,0.12)] text-[#00C4A0]',
}
export function Badge({ variant, children, className }: { variant: BadgeVariant; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', badgeStyles[variant], className)}>
      {children}
    </span>
  )
}

// ── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'danger' | 'success'
type BtnSize = 'sm' | 'md' | 'lg'
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-light',
  accent:  'bg-accent text-navy font-bold hover:opacity-90',
  ghost:   'bg-transparent text-slate-500 border border-slate-200 hover:bg-slate-50',
  danger:  'bg-red-500 text-white hover:bg-red-600',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'px-2.5 py-1 text-[11px] rounded-md',
  md: 'px-4 py-[7px] text-xs rounded-lg',
  lg: 'px-5 py-2.5 text-[13px] rounded-[10px]',
}
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
}
export function Btn({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center gap-1.5 font-semibold cursor-pointer transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed',
        btnVariants[variant], btnSizes[size], className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('bg-white border border-slate-200 rounded-2xl shadow-sm', className)}>
      {children}
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.6px] mb-1">{label}</div>
      <div className={cx('font-mono text-[22px] font-bold tracking-[-1px] text-slate-900', valueClass)}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}
export function Input({ label, className, ...props }: InputProps) {
  return (
    <div>
      {label && <label className="text-[11px] font-semibold text-slate-500 block mb-1">{label}</label>}
      <input
        className={cx('w-full px-2.5 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-xs text-slate-900 bg-white font-sans focus:border-navy focus:outline-none', className)}
        {...props}
      />
    </div>
  )
}

// ── Chip ─────────────────────────────────────────────────────────────────────
export function Chip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      className={cx('inline-flex items-center px-2.5 py-[3px] rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200', onClick && 'cursor-pointer hover:bg-slate-200')}
    >
      {children}
    </span>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ show, onClose, children }: { show: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-[380px] max-w-[90%] shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'danger' | 'warn' | 'info'
export interface ToastItem { id: number; msg: string; type: ToastType }
const toastColors: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  danger:  'bg-red-500',
  warn:    'bg-amber-500',
  info:    'bg-navy',
}
const toastIcons: Record<ToastType, string> = { success: '✓', danger: '✕', warn: '⚠', info: 'ℹ' }

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="fixed top-[60px] right-4 z-[300] flex flex-col gap-1.5">
      {toasts.map(t => (
        <div key={t.id} className={cx('toast-slide px-3.5 py-2 rounded-[10px] text-xs font-medium flex items-center gap-1.5 text-white shadow-lg', toastColors[t.type])}>
          <span>{toastIcons[t.type]}</span>{t.msg}
        </div>
      ))}
    </div>
  )
}

// ── CardTitle ────────────────────────────────────────────────────────────────
export function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.6px] mb-3.5">{children}</div>
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
