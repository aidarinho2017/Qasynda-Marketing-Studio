'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Coins } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { CREDITS_PER_IMAGE, TOPUP_PACKS, useCredits } from '@/lib/credits';

export default function TopupPage() {
  const router = useRouter();
  const { balance } = useCredits();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

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
        <p className="text-sm text-gray-500 mb-8">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOPUP_PACKS.map((pack) => {
            const pricePerCredit = pack.price_usd / pack.credits;
            const isBest = pricePerCredit === cheapestPricePerCredit;
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
                    onClick={() => router.push(`/topup/checkout?pack=${pack.id}`)}
                    className={[
                      'w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                      isBest
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800',
                    ].join(' ')}
                  >
                    Buy for ${pack.price_usd.toFixed(2)}
                    <ArrowRight className="w-4 h-4" />
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
