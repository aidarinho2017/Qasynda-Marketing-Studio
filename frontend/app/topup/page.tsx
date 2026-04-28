'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Coins, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import {
  CREDITS_PER_IMAGE,
  TOPUP_PACKS,
  topupCredits,
  useCredits,
} from '@/lib/credits';

export default function TopupPage() {
  const router = useRouter();
  const { balance } = useCredits();
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    packId: string;
    creditsAdded: number;
    newBalance: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  const handleBuy = async (packId: string) => {
    setBusyPackId(packId);
    setError(null);
    try {
      const res = await topupCredits(packId);
      setSuccess({
        packId,
        creditsAdded: res.credits_added,
        newBalance: res.credits_balance,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
    } finally {
      setBusyPackId(null);
    }
  };

  const cheapestPricePerCredit = Math.min(
    ...TOPUP_PACKS.map((p) => p.price_usd / p.credits),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-2 flex items-center gap-2">
          <Coins className="w-5 h-5 text-indigo-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Top up credits</h1>
        </div>
        <p className="text-sm text-gray-500 mb-2">
          {balance === null ? (
            'Loading current balance…'
          ) : (
            <>
              Current balance:{' '}
              <span className="font-semibold text-gray-700 tabular-nums">{balance}</span>{' '}
              credits.
            </>
          )}{' '}
          Each generation costs from <span className="font-medium">{CREDITS_PER_IMAGE}</span>{' '}
          credits.
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 inline-block mb-8">
          Demo mode — no real payment will be charged.
        </p>

        {success && (
          <div className="mb-8 flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">+{success.creditsAdded} credits added</p>
              <p className="text-sm text-green-700">
                New balance:{' '}
                <span className="font-semibold tabular-nums">{success.newBalance}</span>
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOPUP_PACKS.map((pack) => {
            const pricePerCredit = pack.price_usd / pack.credits;
            const isBest = pricePerCredit === cheapestPricePerCredit;
            const isBusy = busyPackId === pack.id;
            return (
              <div
                key={pack.id}
                className={[
                  'relative flex flex-col bg-white rounded-2xl border p-6 shadow-sm transition-all',
                  isBest ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100',
                ].join(' ')}
              >
                {isBest && (
                  <span className="absolute -top-2.5 left-6 px-2 py-0.5 bg-indigo-600 text-white text-[11px] font-semibold rounded-full">
                    Best value
                  </span>
                )}

                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums">
                    {pack.credits}
                  </span>
                  <span className="text-sm font-medium text-gray-500">credits</span>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                  ${pricePerCredit.toFixed(3)} per credit
                </p>

                <div className="mt-auto">
                  <button
                    onClick={() => handleBuy(pack.id)}
                    disabled={busyPackId !== null}
                    className={[
                      'w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                      isBest
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    ].join(' ')}
                  >
                    {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isBusy ? 'Adding…' : `Buy for $${pack.price_usd.toFixed(2)}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
