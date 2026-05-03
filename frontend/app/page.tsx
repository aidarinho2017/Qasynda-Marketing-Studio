'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { api } from '@/lib/api';
import { setToken, setUser, isAuthenticated } from '@/lib/auth';
import { TOPUP_PACKS } from '@/lib/credits';
import type { TokenResponse } from '@/lib/types';

const BRAND_GREEN = '#89F336';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type AuthTab = 'signin' | 'register';

export default function LandingPage() {
  const router = useRouter();

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  const finishAuth = (data: TokenResponse) => {
    setToken(data.access_token);
    setUser({ name: data.user.name, avatar: data.user.avatar });
    router.push('/dashboard');
  };

  const handleGoogleSuccess = async (credential: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await api.post<TokenResponse>('/auth/google', { id_token: credential });
      finishAuth(data);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
      setAuthLoading(false);
    }
  };

  const handleEmailSignin = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await api.post<TokenResponse>('/auth/login', { email, password });
      finishAuth(data);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed.');
      setAuthLoading(false);
    }
  };

  const handleEmailRegister = async (
    first_name: string,
    last_name: string,
    email: string,
    password: string,
  ) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await api.post<TokenResponse>('/auth/register', {
        first_name,
        last_name,
        email,
        password,
      });
      finishAuth(data);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed.');
      setAuthLoading(false);
    }
  };

  const openAuth = (tab: AuthTab = 'signin') => {
    setAuthError(null);
    setAuthTab(tab);
    setAuthOpen(true);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar onAuth={openAuth} />

      <main>
        <Hero onPrimary={openAuth} onSecondary={openAuth} />
        <ValueProposition />
        <HowItWorks />
        <ExampleSection />
        <Features />
        <WhoItsFor />
        <Pricing onClick={openAuth} />
        <Trust />
        <FinalCTA onClick={openAuth} />
      </main>

      <Footer />

      {authOpen && (
        <AuthModal
          tab={authTab}
          onTabChange={setAuthTab}
          onClose={() => setAuthOpen(false)}
          onGoogleSuccess={handleGoogleSuccess}
          onEmailSignin={handleEmailSignin}
          onEmailRegister={handleEmailRegister}
          loading={authLoading}
          error={authError}
          clearError={() => setAuthError(null)}
        />
      )}
    </div>
    </GoogleOAuthProvider>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ onAuth }: { onAuth: (tab?: AuthTab) => void }) {
  return (
    <header className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-tight">Qasynda</span>
        <nav className="flex items-center gap-1">
          <button
            onClick={() => onAuth('signin')}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => onAuth('register')}
            style={{ backgroundColor: BRAND_GREEN }}
            className="text-sm font-semibold text-gray-900 hover:brightness-95 rounded-md px-4 py-2 transition-all"
          >
            Get Started
          </button>
        </nav>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] text-gray-900">
            Create marketplace-ready product images in seconds
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl">
            Generate high-converting product cards and ad visuals for Kaspi and Wildberries —
            without designers or expensive shoots.
          </p>
          <div className="mt-9 flex items-center gap-6">
            <button
              onClick={onPrimary}
              style={{ backgroundColor: BRAND_GREEN }}
              className="text-sm font-semibold text-gray-900 hover:brightness-95 rounded-md px-5 py-2.5 transition-all shadow-sm"
            >
              Get Started
            </button>
            <button
              onClick={onSecondary}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Try with a sample →
            </button>
          </div>
        </div>

        <ProductCardGrid />
      </div>
    </section>
  );
}

const HERO_IMAGES = ['/hero1.png', '/hero2.png', '/hero3.png', '/hero4.png'];

function ProductCardGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {HERO_IMAGES.map((src) => (
        <div
          key={src}
          className="relative aspect-square rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="(min-width: 1024px) 280px, 50vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Value Proposition ───────────────────────────────────────────────────────

function ValueProposition() {
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
          Stop wasting time and money on product design
        </h2>
        <ul className="mt-8 space-y-3 text-base text-gray-700">
          <li className="flex items-start">
            <span className="text-gray-300 mr-3 mt-px">—</span>
            No more expensive designers
          </li>
          <li className="flex items-start">
            <span className="text-gray-300 mr-3 mt-px">—</span>
            No more waiting days for visuals
          </li>
          <li className="flex items-start">
            <span className="text-gray-300 mr-3 mt-px">—</span>
            No more low-quality listings
          </li>
        </ul>
        <p className="mt-8 text-base text-gray-600">
          Just upload your product and get ready-to-use images.
        </p>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: 1,
      title: 'Upload your product',
      body: 'Add a simple product photo — even from your phone.',
    },
    {
      n: 2,
      title: 'Choose style',
      body: 'Select marketplace card or ad-style visuals.',
    },
    {
      n: 3,
      title: 'Get ready-to-use images',
      body: 'Download images optimized for Kaspi and Wildberries.',
    },
  ];

  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">How it works</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-10">
          {steps.map((s) => (
            <div key={s.n}>
              <span className="text-xs font-medium text-gray-400 tracking-wider">
                STEP {String(s.n).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-base font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Example Section ─────────────────────────────────────────────────────────

function ExampleSection() {
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            Turn any product photo into a selling image
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            Our AI creates structured, high-converting visuals that match top marketplace listings.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <BeforeAfterImage label="Before" src="/before.jpg" />
          <BeforeAfterImage label="After" src="/after.png" />
        </div>
      </div>
    </section>
  );
}

function BeforeAfterImage({ label, src }: { label: string; src: string }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div className="relative aspect-[4/3]">
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="px-4 py-3 border-t border-gray-100">
        <span className="text-xs font-medium text-gray-500 tracking-wider">
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  const items = [
    {
      title: 'Marketplace-optimized cards',
      body: 'Automatically structured layouts with titles, benefits, and clean design for Kaspi and Wildberries.',
    },
    {
      title: 'Ad-ready visuals',
      body: 'Generate images for ads and social media in seconds.',
    },
    {
      title: 'Built for speed',
      body: 'Get multiple image variations in under a minute.',
    },
  ];
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-20 space-y-10">
        {items.map((it) => (
          <div key={it.title}>
            <h3 className="text-lg font-semibold text-gray-900">{it.title}</h3>
            <p className="mt-1.5 text-base text-gray-600 leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Who It's For ────────────────────────────────────────────────────────────

function WhoItsFor() {
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
          Built for marketplace sellers
        </h2>
        <ul className="mt-8 space-y-3 text-base text-gray-700">
          <li className="flex items-start">
            <span className="text-gray-300 mr-3 mt-px">—</span>
            Kaspi & Wildberries sellers
          </li>
          <li className="flex items-start">
            <span className="text-gray-300 mr-3 mt-px">—</span>
            Small e-commerce brands
          </li>
          <li className="flex items-start">
            <span className="text-gray-300 mr-3 mt-px">—</span>
            Local businesses and resellers
          </li>
        </ul>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

const PACK_COPY: Record<string, { tagline: string; bullets: string[] }> = {
  basic: {
    tagline: 'Perfect for testing the waters.',
    bullets: ['Up to 10 generations', 'All marketplace styles', 'UGC mode included'],
  },
  pro: {
    tagline: 'For active sellers shipping new listings every week.',
    bullets: ['Up to 20 generations', 'Priority queue', 'All marketplace + UGC styles'],
  },
  ultra: {
    tagline: 'Best value for stores running ads and large catalogs.',
    bullets: [
      'Up to 100 generations',
      'Priority queue',
      'Lowest price per credit',
      'All marketplace + UGC styles',
    ],
  },
};

function Pricing({ onClick }: { onClick: () => void }) {
  const cheapest = Math.min(...TOPUP_PACKS.map((p) => p.price_usd / p.credits));

  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            Simple, pay-as-you-go pricing
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            Buy credits when you need them — they never expire. Each generation
            costs from <span className="font-semibold text-gray-900">5 credits</span>.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {TOPUP_PACKS.map((pack) => {
            const pricePerCredit = pack.price_usd / pack.credits;
            const isBest = pricePerCredit === cheapest;
            const copy = PACK_COPY[pack.id] ?? { tagline: '', bullets: [] };

            return (
              <div
                key={pack.id}
                className={[
                  'relative flex flex-col bg-white rounded-2xl border p-7',
                  isBest ? 'border-gray-900 shadow-lg' : 'border-gray-200',
                ].join(' ')}
                style={isBest ? { boxShadow: `0 0 0 1px ${BRAND_GREEN}40, 0 10px 30px -10px rgba(0,0,0,0.15)` } : undefined}
              >
                {isBest && (
                  <span
                    className="absolute -top-3 left-7 px-2.5 py-1 text-[11px] font-bold text-gray-900 rounded-full"
                    style={{ backgroundColor: BRAND_GREEN }}
                  >
                    BEST VALUE
                  </span>
                )}

                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  {pack.name ?? pack.id}
                </h3>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
                    ${pack.price_usd.toFixed(0)}
                  </span>
                  <span className="text-sm text-gray-500">one-time</span>
                </div>

                <p className="mt-2 text-sm text-gray-700 font-medium">
                  {pack.credits} credits
                  <span className="text-gray-400 font-normal">
                    {' '}· ${pricePerCredit.toFixed(3)}/credit
                  </span>
                </p>

                <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                  {copy.tagline}
                </p>

                <ul className="mt-5 space-y-2.5 text-sm text-gray-700 flex-1">
                  {copy.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-gray-900 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={onClick}
                  style={isBest ? { backgroundColor: BRAND_GREEN } : undefined}
                  className={[
                    'mt-7 w-full py-2.5 px-4 rounded-md text-sm font-semibold transition-all',
                    isBest
                      ? 'text-gray-900 hover:brightness-95 shadow-sm'
                      : 'text-white bg-gray-900 hover:bg-gray-800',
                  ].join(' ')}
                >
                  Get {pack.name ?? pack.id}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          New accounts get 5 free credits — try it before you buy anything.
        </p>
      </div>
    </section>
  );
}

// ─── Trust ───────────────────────────────────────────────────────────────────

function Trust() {
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
          Designed for real marketplace needs
        </h2>
        <p className="mt-4 text-base text-gray-600 leading-relaxed">
          We focus on what actually matters — images that are ready to upload and help you sell more.
        </p>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA({ onClick }: { onClick: () => void }) {
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
          Start creating product images that sell
        </h2>
        <button
          onClick={onClick}
          style={{ backgroundColor: BRAND_GREEN }}
          className="mt-8 text-sm font-semibold text-gray-900 hover:brightness-95 rounded-md px-6 py-3 transition-all shadow-sm"
        >
          Generate images now
        </button>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between text-sm text-gray-500">
        <span>Qasynda</span>
        <nav className="flex items-center gap-6">
          <a href="#" className="hover:text-gray-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Contact</a>
        </nav>
      </div>
    </footer>
  );
}

// ─── Auth Modal ──────────────────────────────────────────────────────────────

function AuthModal({
  tab,
  onTabChange,
  onClose,
  onGoogleSuccess,
  onEmailSignin,
  onEmailRegister,
  loading,
  error,
  clearError,
}: {
  tab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  onClose: () => void;
  onGoogleSuccess: (credential: string) => Promise<void>;
  onEmailSignin: (email: string, password: string) => Promise<void>;
  onEmailRegister: (
    first_name: string,
    last_name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const switchTab = (next: AuthTab) => {
    if (next === tab) return;
    clearError();
    onTabChange(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (tab === 'signin') {
      onEmailSignin(email, password);
    } else {
      onEmailRegister(firstName, lastName, email, password);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-sm w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">
          {tab === 'signin' ? 'Sign in to Qasynda' : 'Create your Qasynda account'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {tab === 'signin'
            ? 'Welcome back. Use Google or your email to continue.'
            : 'Start generating images in seconds.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => switchTab('signin')}
            className={[
              'text-sm font-medium py-1.5 rounded-md transition-colors',
              tab === 'signin'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900',
            ].join(' ')}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchTab('register')}
            className={[
              'text-sm font-medium py-1.5 rounded-md transition-colors',
              tab === 'register'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900',
            ].join(' ')}
          >
            Register
          </button>
        </div>

        <div className="mt-5 flex justify-center min-h-[44px] items-center">
          {GOOGLE_CLIENT_ID ? (
            <GoogleLogin
              onSuccess={(res) => {
                if (res.credential) onGoogleSuccess(res.credential);
              }}
              onError={() => {}}
              theme="outline"
              size="large"
              shape="rectangular"
              text={tab === 'signin' ? 'signin_with' : 'signup_with'}
              locale="en"
            />
          ) : (
            <p className="text-xs text-gray-500 text-center">
              Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{' '}
              <code className="font-mono">.env.local</code> to enable Google sign in.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          <span>or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {tab === 'register' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                maxLength={100}
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50"
              />
              <input
                type="text"
                required
                maxLength={100}
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50"
              />
            </div>
          )}
          <input
            type="email"
            required
            autoComplete={tab === 'signin' ? 'email' : 'email'}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50"
          />
          <input
            type="password"
            required
            minLength={tab === 'register' ? 8 : 1}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            placeholder={tab === 'register' ? 'Password (min 8 characters)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: BRAND_GREEN }}
            className="w-full py-2.5 text-sm font-semibold text-gray-900 rounded-md hover:brightness-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? tab === 'signin' ? 'Signing in…' : 'Creating account…'
              : tab === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-5 w-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
