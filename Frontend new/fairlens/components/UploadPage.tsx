'use client'
import { useRef, useState } from 'react'
import { Card, Input, Btn } from './ui'
import type { Page } from '@/lib/data'

export default function UploadPage({ onNav }: { onNav: (p: Page) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
  }

  function removeFile() {
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function formatSize(bytes: number) {
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
  }

  const steps = [
    { n: 1, label: 'Upload',   done: true  },
    { n: 2, label: 'Analysis', done: false },
    { n: 3, label: 'Decision', done: false },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[1100px] mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">EMI Risk Assessment</div>
          <div className="text-xs text-slate-500 mt-0.5">Upload your bank statement to get started</div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2.5 mb-5">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
              s.done ? 'bg-accent text-navy' : 'bg-slate-200 text-slate-400'
            }`}>{s.n}</div>
            <span className={`text-[11px] font-medium ${s.done ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
            {i < steps.length - 1 && <div className="w-8 h-[1.5px] bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-4">
        {/* Upload Card */}
        <Card className="p-[18px]">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.6px] mb-3.5">Bank Statement</div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {!file ? (
            <div
              className={`drop-zone${dragging ? ' dragging' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]) }}
            >
              <div className="text-[28px] mb-2.5">📄</div>
              <div className="text-[13px] text-slate-500 font-semibold mb-1">Click to browse or drag &amp; drop</div>
              <div className="text-[11px] text-slate-400">PDF, CSV, XLSX accepted · Max 10MB</div>
              <div className="mt-3.5">
                <span className="inline-block px-5 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold">Browse File</span>
              </div>
            </div>
          ) : (
            <div className="file-preview">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-[10px] bg-[rgba(0,245,196,0.15)] flex items-center justify-center text-[20px] flex-shrink-0">📋</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{file.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{formatSize(file.size)} · {file.type || 'Document'}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-emerald-500 text-base font-bold">✓</span>
                  <button onClick={removeFile} className="w-[22px] h-[22px] rounded-full bg-slate-100 border-none cursor-pointer text-[11px] text-slate-500 flex items-center justify-center hover:bg-slate-200">✕</button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[rgba(0,245,196,0.2)] flex items-center justify-between">
                <span className="text-[11px] text-emerald-600 font-semibold">✓ File ready for analysis</span>
                <button onClick={() => fileRef.current?.click()} className="text-[11px] text-slate-400 bg-none border-none cursor-pointer underline">Replace</button>
              </div>
            </div>
          )}

          <div className="mt-3 p-2.5 rounded-lg border border-[rgba(0,245,196,0.3)] bg-[rgba(0,245,196,0.08)]">
            <div className="text-[10px] text-slate-500 leading-relaxed">
              <strong className="text-slate-900">🔒 Privacy First:</strong> Your data is processed locally and never stored beyond 24 hours.
            </div>
          </div>
        </Card>

        {/* Financial Form */}
        <Card className="p-[18px]">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.6px] mb-3.5">Financial Profile</div>
          <div className="mb-2.5"><Input label="Credit Score (CIBIL)" type="number" defaultValue="720" placeholder="300–900" /></div>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Input label="Monthly Income (₹)" type="number" defaultValue="85000" />
            <Input label="Monthly Expenses (₹)" type="number" defaultValue="42000" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Input label="Existing EMIs (₹/mo)" type="number" defaultValue="8500" />
            <Input label="Requested EMI (₹/mo)" type="number" defaultValue="3667" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Savings Buffer (₹)" type="number" defaultValue="220000" />
            <Input label="DTI Ratio (%)" type="number" defaultValue="28" />
          </div>
        </Card>
      </div>

      <div className="flex gap-2.5 justify-end">
        <Btn variant="ghost" onClick={() => onNav('checkout')}>← Back</Btn>
        <Btn
          variant="primary"
          size="lg"
          disabled={!file}
          onClick={() => file && onNav('risk')}
        >
          Analyze Risk with AI →
        </Btn>
      </div>
    </div>
  )
}
