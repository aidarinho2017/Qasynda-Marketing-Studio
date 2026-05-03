'use client';

import { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import FoundationOutput from './output/FoundationOutput';
import AcquisitionOutput from './output/AcquisitionOutput';
import type {
  AcquisitionStructured,
  CoachMessage,
  CoachModule,
  FoundationStructured,
  NextAction,
} from '../lib/coachTypes';

interface Props {
  message: CoachMessage;
  showActions?: boolean;
  animate?: boolean;
  onAction?: (action: NextAction) => void;
}

const CHARS_PER_TICK = 3;
const TICK_MS = 18;

export default function AssistantMessage({ message, showActions, animate, onAction }: Props) {
  const structured = message.structured_output?.structured ?? null;
  const nextActions = message.structured_output?.next_actions ?? [];
  const module = message.module as CoachModule | null;
  const total = message.content.length;

  const [revealed, setRevealed] = useState(animate ? 0 : total);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate) {
      setRevealed(total);
      return;
    }
    setRevealed(0);
    let current = 0;
    const id = window.setInterval(() => {
      current = Math.min(total, current + CHARS_PER_TICK);
      setRevealed(current);
      if (current >= total) window.clearInterval(id);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [animate, message.id, total]);

  useEffect(() => {
    if (!animate) return;
    if (revealed % 30 === 0 || revealed >= total) {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [revealed, animate, total]);

  const isDone = revealed >= total;
  const displayed = animate ? message.content.slice(0, revealed) : message.content;

  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center">
        <Compass className="w-4 h-4 text-brand-600" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
          {displayed}
          {animate && !isDone && (
            <span className="inline-block w-1.5 h-3.5 bg-gray-400 ml-0.5 align-[-2px] animate-pulse" />
          )}
        </div>

        {isDone && structured && module && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 animate-in fade-in duration-300">
            <StructuredCard module={module} structured={structured as Record<string, unknown>} />
          </div>
        )}

        {isDone && showActions && nextActions.length > 0 && onAction && (
          <div className="flex flex-wrap gap-1.5 pt-1 animate-in fade-in duration-300">
            {nextActions.slice(0, 4).map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAction(a)}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function StructuredCard({
  module,
  structured,
}: {
  module: CoachModule;
  structured: Record<string, unknown>;
}) {
  if (module === 'foundation') {
    return <FoundationOutput data={structured as unknown as FoundationStructured} />;
  }
  if (module === 'acquisition') {
    return <AcquisitionOutput data={structured as unknown as AcquisitionStructured} />;
  }
  return null;
}
