'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, X } from 'lucide-react';
import { TOPUP_PACKS, onInsufficientCredits } from '@/lib/credits';

export default function InsufficientCreditsModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return onInsufficientCredits((msg) => {
      setMessage(msg ?? null);
      setOpen(true);
    });
  }, []);

  if (!open) return null;

  const cheapestPerCredit = Math.min(
    ...TOPUP_PACKS.map((p) => p.price_usd / p.credits),
  );

  const choosePack = (packId: string) => {
    setOpen(false);
    router.push(`/topup/checkout?pack=${packId}`);
  };

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-[60] bg-gray-900/40 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50">
              <Coins className="w-4 h-4 text-brand-600" />
            </span>
            <h3 className="text-base font-semibold text-gray-900">
              Top up your credits
            </h3>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          {message ?? 'You need credits to use this feature. Pick a pack to continue.'}
        </p>

        <div className="mt-5 space-y-2">
          {TOPUP_PACKS.map((pack) => {
            const perCredit = pack.price_usd / pack.credits;
            const isBest = perCredit === cheapestPerCredit;
            return (
              <button
                key={pack.id}
                onClick={() => choosePack(pack.id)}
                className={[
                  'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                  isBest
                    ? 'border-brand-400 bg-brand-50 hover:bg-brand-100'
                    : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {pack.name ?? pack.id}
                    {isBest && (
                      <span className="ml-2 text-[10px] font-bold tracking-wide text-brand-700 uppercase">
                        Best value
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {pack.credits} credits · ${perCredit.toFixed(3)}/credit
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  ${pack.price_usd.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={close}
          className="mt-4 w-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
