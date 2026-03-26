'use client'
import { useRef, useState } from 'react'
import { Card, Chip, Btn } from './ui'
import { getBotResponse } from '@/lib/data'

interface Msg { id: number; text: string; type: 'bot' | 'user' }

let msgId = 1

export default function SupportPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, text: "Hi! I'm the FairLens AI assistant. I can help you understand your EMI eligibility, explain your risk score, or answer any questions about the EMI process. How can I help you today?", type: 'bot' },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  function scrollBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function sendMsg(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    setInput('')
    setMsgs(prev => [...prev, { id: msgId++, text: msg, type: 'user' }])
    setThinking(true)
    scrollBottom()
    setTimeout(() => {
      setThinking(false)
      setMsgs(prev => [...prev, { id: msgId++, text: getBotResponse(msg), type: 'bot' }])
      scrollBottom()
    }, 1200 + Math.random() * 600)
  }

  const QUICK = [
    'Why was my EMI rejected?',
    'How is risk score calculated?',
    'What documents do I need?',
    'How long does review take?',
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[680px] mx-auto w-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold tracking-[-0.5px]">AI Support Assistant</div>
          <div className="text-xs text-slate-500 mt-0.5">Powered by FairLens AI · Usually replies instantly</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[7px] h-[7px] rounded-full bg-emerald-500" />
          <span className="text-[10px] text-slate-500">Online</span>
        </div>
      </div>

      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ maxHeight: 420 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
          {msgs.map(m => (
            <div key={m.id} className={`flex gap-2 max-w-[75%] ${m.type === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                m.type === 'bot'
                  ? 'bg-[rgba(0,245,196,0.12)] border-[1.5px] border-accent'
                  : 'bg-navy text-white'
              }`}>
                {m.type === 'bot' ? '🤖' : '👤'}
              </div>
              <div className={`px-3 py-2 text-xs leading-relaxed ${
                m.type === 'bot'
                  ? 'bg-white border border-slate-200 rounded-[3px_14px_14px_14px] text-slate-900'
                  : 'bg-navy text-white rounded-[14px_3px_14px_14px]'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex gap-2 max-w-[75%] self-start">
              <div className="w-7 h-7 rounded-full bg-[rgba(0,245,196,0.12)] border-[1.5px] border-accent flex items-center justify-center text-xs flex-shrink-0">🤖</div>
              <div className="bg-white border border-slate-200 rounded-[3px_14px_14px_14px] px-3 py-2 flex items-center gap-1">
                <span className="thinking-dot" />
                <span className="thinking-dot" style={{ animationDelay: '0.15s' }} />
                <span className="thinking-dot" style={{ animationDelay: '0.30s' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-1.5 p-3 border-t border-slate-200">
          <input
            className="flex-1 px-2.5 py-[7px] border-[1.5px] border-slate-200 rounded-lg text-xs text-slate-900 bg-white font-sans focus:border-navy focus:outline-none"
            placeholder="Ask anything about EMI, risk scores, eligibility..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMsg()}
          />
          <Btn variant="primary" onClick={() => sendMsg()}>Send ↑</Btn>
        </div>
      </Card>

      <div className="flex gap-1.5 mt-2.5 flex-wrap">
        {QUICK.map(q => (
          <Chip key={q} onClick={() => sendMsg(q)}>{q}</Chip>
        ))}
      </div>
    </div>
  )
}
