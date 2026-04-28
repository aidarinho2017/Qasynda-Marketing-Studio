'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { api } from '@/lib/api';
import { setToken, setUser, isAuthenticated } from '@/lib/auth';
import type { TokenResponse } from '@/lib/types';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LandingPage() {
  const router = useRouter();

  const [authOpen, setAuthOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  const handleGoogleSuccess = async (credential: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await api.post<TokenResponse>('/auth/google', { id_token: credential });
      setToken(data.access_token);
      setUser({ name: data.user.name, avatar: data.user.avatar });
      router.push('/dashboard');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
      setAuthLoading(false);
    }
  };

  const openAuth = () => {
    setAuthError(null);
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
        <Trust />
        <FinalCTA onClick={openAuth} />
      </main>

      <Footer />

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={handleGoogleSuccess}
          loading={authLoading}
          error={authError}
        />
      )}
    </div>
    </GoogleOAuthProvider>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ onAuth }: { onAuth: () => void }) {
  return (
    <header className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-tight">Qasynda</span>
        <nav className="flex items-center gap-1">
          <button
            onClick={onAuth}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors"
          >
            Login
          </button>
          <button
            onClick={onAuth}
            className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md px-4 py-2 transition-colors"
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
              className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md px-5 py-2.5 transition-colors"
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

function ProductCardGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { tone: 'bg-gray-100' },
        { tone: 'bg-gray-50' },
        { tone: 'bg-gray-50' },
        { tone: 'bg-gray-100' },
      ].map((card, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white overflow-hidden"
        >
          <div className={`aspect-square ${card.tone}`} />
          <div className="p-3 space-y-1.5">
            <div className="h-2 w-3/4 rounded bg-gray-200" />
            <div className="h-2 w-1/2 rounded bg-gray-100" />
          </div>
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
          <BeforeAfter label="Before" />
          <BeforeAfter label="After" tone="bg-gray-100" />
        </div>
      </div>
    </section>
  );
}

function BeforeAfter({ label, tone = 'bg-gray-50' }: { label: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div className={`aspect-[4/3] ${tone}`} />
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 tracking-wider">{label.toUpperCase()}</span>
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
          className="mt-8 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md px-6 py-3 transition-colors"
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
  onClose,
  onSuccess,
  loading,
  error,
}: {
  onClose: () => void;
  onSuccess: (credential: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-sm w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">Sign in to Qasynda</h3>
        <p className="mt-1 text-sm text-gray-500">
          Continue with Google to start generating images.
        </p>

        <div className="mt-6 flex justify-center min-h-[44px] items-center">
          {loading ? (
            <span className="text-sm text-gray-500">Signing in…</span>
          ) : GOOGLE_CLIENT_ID ? (
            <GoogleLogin
              onSuccess={(res) => {
                if (res.credential) onSuccess(res.credential);
              }}
              onError={() => {}}
              theme="outline"
              size="large"
              shape="rectangular"
              text="continue_with"
              locale="en"
            />
          ) : (
            <p className="text-xs text-gray-500 text-center">
              Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{' '}
              <code className="font-mono">.env.local</code> to enable sign in.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
