'use client'
import { Modal, Btn } from './ui'

// ── High Risk Modal ───────────────────────────────────────────────────────────
export function HRModal({ show, onClose, onSubmit }: { show: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <Modal show={show} onClose={onClose}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[20px]">⚠️</span>
        <div className="text-[15px] font-bold">High Risk Detected</div>
      </div>
      <div className="text-xs text-slate-500 leading-relaxed mb-4">
        Your application shows a <strong>High Debt Trap Probability (78%)</strong>. This EMI cannot be auto-approved and will be submitted to the bank for <strong>manual review</strong>.
        <br /><br />
        You'll be notified via email once the bank reviews your case (1–2 business days).
      </div>
      <div className="flex gap-2 justify-end">
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" onClick={onSubmit}>Submit for Review</Btn>
      </div>
    </Modal>
  )
}

// ── Override Modal ────────────────────────────────────────────────────────────
export function OverrideModal({ show, onClose, onConfirm }: { show: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal show={show} onClose={onClose}>
      <div className="text-[15px] font-bold mb-2">Manual Override</div>
      <div className="text-xs text-slate-500 mb-4">You are overriding the system's risk decision. Please provide a reason.</div>
      <div className="mb-3">
        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Override Reason</label>
        <select className="w-full px-2.5 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-xs text-slate-900 bg-white font-sans focus:border-navy focus:outline-none mt-1">
          <option>Customer has strong collateral</option>
          <option>Verified additional income sources</option>
          <option>Long-standing customer</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Notes (optional)</label>
        <textarea
          className="w-full px-2.5 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-xs text-slate-900 bg-white font-sans focus:border-navy focus:outline-none mt-1 resize-none"
          rows={2}
          placeholder="Add notes..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" onClick={onConfirm}>Confirm Override</Btn>
      </div>
    </Modal>
  )
}
