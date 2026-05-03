'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { TOPUP_PACKS, topupCredits } from '@/lib/credits';
import type { TopupPack } from '@/lib/types';

// ─── Card formatting helpers ────────────────────────────────────────────────

function detectCardBrand(digits: string): 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown' {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^6(?:011|5)/.test(digits)) return 'discover';
  return 'unknown';
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  // Amex: 4-6-5 grouping, others: groups of 4
  if (/^3[47]/.test(digits)) {
    return digits.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' '),
    );
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function brandLabel(brand: ReturnType<typeof detectCardBrand>): string {
  switch (brand) {
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return 'Mastercard';
    case 'amex':
      return 'Amex';
    case 'discover':
      return 'Discover';
    default:
      return '';
  }
}

// ─── Order summary ───────────────────────────────────────────────────────────

function OrderSummary({ pack }: { pack: TopupPack }) {
  const subtotal = pack.price_usd;
  const tax = +(subtotal * 0.0).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Order summary
      </h2>

      <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <p className="font-semibold text-gray-900">
            {pack.credits} Qasynda credits
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            One-time purchase · ${(pack.price_usd / pack.credits).toFixed(3)} per credit
          </p>
        </div>
        <p className="font-semibold text-gray-900 tabular-nums">
          ${subtotal.toFixed(2)}
        </p>
      </div>

      <div className="space-y-2 py-4 border-b border-gray-100 text-sm">
        <div className="flex items-center justify-between text-gray-500">
          <span>Subtotal</span>
          <span className="tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-gray-500">
          <span>Tax</span>
          <span className="tabular-nums">${tax.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <span className="font-semibold text-gray-900">Total due</span>
        <span className="text-lg font-bold text-gray-900 tabular-nums">
          ${total.toFixed(2)} <span className="text-xs font-medium text-gray-500">USD</span>
        </span>
      </div>
    </div>
  );
}

// ─── Checkout content ───────────────────────────────────────────────────────

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packId = searchParams.get('pack');
  const pack = useMemo(
    () => TOPUP_PACKS.find((p) => p.id === packId) ?? null,
    [packId],
  );

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [country, setCountry] = useState('KZ');
  const [postal, setPostal] = useState('');

  const [phase, setPhase] = useState<'idle' | 'processing' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  useEffect(() => {
    if (packId !== null && pack === null) {
      router.replace('/topup');
    }
  }, [packId, pack, router]);

  if (!pack) return null;

  const cardDigits = number.replace(/\D/g, '');
  const brand = detectCardBrand(cardDigits);
  const expiryDigits = expiry.replace(/\D/g, '');
  const cvcMax = brand === 'amex' ? 4 : 3;

  const valid =
    email.includes('@') &&
    name.trim().length > 1 &&
    cardDigits.length >= 13 &&
    expiryDigits.length === 4 &&
    cvc.length >= 3 &&
    postal.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || phase !== 'idle') return;
    setPhase('processing');
    setError(null);

    // Fake processing delay
    await new Promise((r) => setTimeout(r, 1800));

    try {
      await topupCredits(pack.id);
      setPhase('success');
      setTimeout(() => router.push('/dashboard'), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setPhase('idle');
    }
  };

  if (phase === 'success') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showUserMenu />
        <main className="max-w-md mx-auto px-4 sm:px-6 pt-32">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Payment successful</h2>
            <p className="text-sm text-gray-500 mb-6">
              {pack.credits} credits have been added to your account.
            </p>
            <p className="text-xs text-gray-400">Redirecting to your dashboard…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <button
          onClick={() => router.push('/topup')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to packs
        </button>

        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>
            <strong>Test mode</strong> — this is a demo checkout. No real card will be charged.
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Checkout</h1>
        <p className="text-sm text-gray-500 mb-8">
          Secure payment powered by <span className="font-semibold text-gray-700">Qasynda Pay</span>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Payment form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Section title="Contact">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
            </Section>

            <Section title="Payment method">
              <div className="flex items-center gap-2 px-4 py-3 bg-brand-50 border border-brand-100 rounded-xl mb-4">
                <CreditCard className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-medium text-brand-700">Card</span>
              </div>

              <Field label="Card number">
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 1234 1234 1234"
                    value={number}
                    onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                    maxLength={brand === 'amex' ? 17 : 23}
                  />
                  {brand !== 'unknown' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[11px] font-bold text-gray-700 bg-gray-100 rounded">
                      {brandLabel(brand)}
                    </span>
                  )}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Expiry">
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                  />
                </Field>
                <Field label="CVC">
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder={brand === 'amex' ? '4 digits' : 'CVC'}
                    value={cvc}
                    onChange={(e) =>
                      setCvc(e.target.value.replace(/\D/g, '').slice(0, cvcMax))
                    }
                    maxLength={cvcMax}
                  />
                </Field>
              </div>

              <Field label="Name on card">
                <Input
                  required
                  autoComplete="cc-name"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Billing address">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors"
                  >
                    <option value="KZ">Kazakhstan</option>
                    <option value="RU">Russia</option>
                    <option value="UZ">Uzbekistan</option>
                    <option value="KG">Kyrgyzstan</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Postal code">
                  <Input
                    placeholder="050000"
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    autoComplete="postal-code"
                  />
                </Field>
              </div>
            </Section>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!valid || phase === 'processing'}
              className="w-full py-3.5 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {phase === 'processing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing payment…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Pay ${pack.price_usd.toFixed(2)}
                </>
              )}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              Encrypted and secure. Your card info never touches our servers.
            </p>
          </form>

          {/* Order summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <OrderSummary pack={pack} />
            <p className="mt-4 text-[11px] leading-relaxed text-gray-400 text-center">
              By confirming, you agree to Qasynda&apos;s Terms of Service. Credits are
              non-refundable except where required by law.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── Layout primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
