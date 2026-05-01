'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Compass } from 'lucide-react';
import { GROWTH_TURN_CREDITS, useCredits } from '@/lib/credits';
import AssistantMessage from './AssistantMessage';
import UserMessage from './UserMessage';
import type { CoachMessage, CoachModule, NextAction } from '../lib/coachTypes';

interface Props {
  messages: CoachMessage[];
  module: CoachModule;
  onSend: (message: string, module: CoachModule) => Promise<void>;
  sending: boolean;
  animatingMessageId?: string | null;
}

export default function ChatPane({
  messages,
  module,
  onSend,
  sending,
  animatingMessageId,
}: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (isEmpty) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length, sending, isEmpty]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    await onSend(text, module);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const handleAction = (a: NextAction) => {
    if (sending) return;
    void onSend(a.prompt, a.module);
  };

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Compass className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            What are you building?
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Describe your product or idea and I’ll help you build your growth engine.
          </p>
          <Composer
            draft={draft}
            setDraft={setDraft}
            submit={submit}
            sending={sending}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
          {messages.map((m, i) => {
            if (m.role === 'user') return <UserMessage key={m.id} message={m} />;
            const isLast = i === lastAssistantIdx;
            return (
              <AssistantMessage
                key={m.id}
                message={m}
                showActions={isLast && !sending}
                animate={m.id === animatingMessageId}
                onAction={handleAction}
              />
            );
          })}
          {sending && <ThinkingBubble />}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3">
          <Composer
            draft={draft}
            setDraft={setDraft}
            submit={submit}
            sending={sending}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center animate-pulse">
        <Compass className="w-4 h-4 text-indigo-600" />
      </div>
      <div className="inline-flex items-center gap-1 pt-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  submit,
  sending,
  onKeyDown,
}: {
  draft: string;
  setDraft: (s: string) => void;
  submit: () => void;
  sending: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const { balance } = useCredits();
  const insufficient = balance !== null && balance < GROWTH_TURN_CREDITS;
  const disabled = sending || !draft.trim() || insufficient;

  return (
    <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-2xl shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 px-3 py-2">
      <textarea
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          insufficient
            ? `Need ${GROWTH_TURN_CREDITS} credits — top up to chat`
            : 'Ask anything…'
        }
        className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none py-1.5 max-h-40"
        disabled={sending}
        style={{ minHeight: '24px' }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        className="shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Send"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
