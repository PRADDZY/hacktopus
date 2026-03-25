'use client';

import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { queryAssistant } from '@/lib/fairlensApi';
import type { AssistantAction } from '@/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: AssistantAction[];
};

const starterMessages: ChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    text: 'I can help with EMI checks, statement upload issues, login/access problems, and dashboard support.',
  },
];

const quickPrompts = [
  'EMI approval failed, what should I do?',
  'How to fix statement upload errors?',
  'I cannot access admin dashboard.',
];

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export default function AIAssistantWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);

  const pushAssistantMessage = (text: string, actions?: AssistantAction[]) => {
    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'assistant',
        text,
        actions,
      },
    ]);
  };

  const handleAction = (action: AssistantAction) => {
    if (action.action === 'navigate' && action.target) {
      router.push(action.target);
      setIsOpen(false);
      return;
    }

    if (action.action === 'retry') {
      window.location.reload();
      return;
    }

    if (action.action === 'contact') {
      pushAssistantMessage('Contact support@fairlens.ai or +91 98000 12345 for live escalation.');
    }
  };

  const sendMessage = async (text: string) => {
    const message = text.trim();
    if (!message || isLoading) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'user',
        text: message,
      },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await queryAssistant({
        message,
        context: {
          page: pathname,
        },
      });
      pushAssistantMessage(response.reply, response.suggested_actions);
    } catch {
      pushAssistantMessage('Assistant is temporarily unavailable. Please retry or contact support@fairlens.ai.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-accent p-4 text-white shadow-xl transition hover:opacity-90"
        aria-label="Open AI assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-canvas shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">FairLens Assistant</p>
          <p className="text-sm font-semibold">Support Widget</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1 text-muted hover:bg-card"
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((message) => (
          <div key={message.id} className={`space-y-2 ${message.role === 'user' ? 'text-right' : ''}`}>
            <p
              className={`inline-block rounded-xl px-3 py-2 text-sm ${
                message.role === 'user' ? 'bg-accent text-white' : 'bg-card text-ink'
              }`}
            >
              {message.text}
            </p>
            {message.actions && message.actions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {message.actions.map((action) => (
                  <button
                    key={`${message.id}-${action.label}`}
                    type="button"
                    onClick={() => handleAction(action)}
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        ) : null}
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              className="rounded-full border border-line px-3 py-1 text-[11px] text-muted hover:border-accent hover:text-accent"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            className="input-field"
            placeholder="Ask for help..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent p-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
