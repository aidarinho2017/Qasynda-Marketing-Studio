'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Image from 'next/image';
import { Check, Layers, Zap, Clock, Store, User, Building2, ArrowRight, MessageSquare, Target, LayoutGrid } from 'lucide-react';
import { api } from '@/lib/api';
import { setToken, setUser, isAuthenticated } from '@/lib/auth';
import { TOPUP_PACKS } from '@/lib/credits';
import { useT, interpolate } from '@/lib/i18n';
import { LangSwitcher } from '@/components/Navbar';
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
    setUser({ name: data.user.name, avatar: data.user.avatar, is_admin: data.user.is_admin });
    router.push('/dashboard');
  };

  const { t } = useT();

  const handleGoogleSuccess = async (credential: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await api.post<TokenResponse>('/auth/google', { id_token: credential });
      finishAuth(data);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : t.auth.signinTitle);
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
      setAuthError(err instanceof Error ? err.message : t.auth.signinTitle);
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
      setAuthError(err instanceof Error ? err.message : t.auth.registerTitle);
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
        <MoreTools onClick={openAuth} />
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
  const { t } = useT();
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-tight text-white">Qasynda</span>
        <nav className="flex items-center gap-2">
          <LangSwitcher dark />
          <button
            onClick={() => onAuth('signin')}
            className="text-sm text-gray-400 hover:text-white px-3 py-2 rounded-md transition-colors"
          >
            {t.landing.login}
          </button>
          <button
            onClick={() => onAuth('register')}
            style={{ backgroundColor: BRAND_GREEN }}
            className="text-sm font-semibold text-gray-900 hover:brightness-95 rounded-md px-4 py-2 transition-all"
          >
            {t.landing.getStarted}
          </button>
        </nav>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  const { t } = useT();
  return (
    <section className="bg-gray-950 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1] text-white">
            {t.landing.heroTitle}
          </h1>
          <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-xl">
            {t.landing.heroSubtitle}
          </p>
          <div className="mt-9 flex items-center gap-6">
            <button
              onClick={onPrimary}
              style={{ backgroundColor: BRAND_GREEN }}
              className="text-sm font-semibold text-gray-900 hover:brightness-95 rounded-md px-5 py-2.5 transition-all shadow-sm"
            >
              {t.landing.getStarted}
            </button>
            <button
              onClick={onSecondary}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              {t.landing.trySample}
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
          className="relative aspect-square rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-600 transition-colors"
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
  const { t } = useT();
  const bullets = [t.landing.noExpensiveDesigners, t.landing.noWaiting, t.landing.noLowQuality];
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <h2 className="text-4xl font-semibold tracking-tight text-gray-900">
            {t.landing.stopWasting}
          </h2>
          <div>
            <ul className="space-y-4 text-base text-gray-700">
              {bullets.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 shrink-0" style={{ color: BRAND_GREEN }} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base text-gray-600">{t.landing.justUpload}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const { t } = useT();
  const steps = [
    { n: 1, title: t.landing.step1Title, body: t.landing.step1Body },
    { n: 2, title: t.landing.step2Title, body: t.landing.step2Body },
    { n: 3, title: t.landing.step3Title, body: t.landing.step3Body },
  ];

  return (
    <section className="border-b border-gray-100 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">{t.landing.howItWorks}</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-10">
          {steps.map((s) => (
            <div key={s.n}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-gray-900"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                {s.n}
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{s.title}</h3>
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
  const { t } = useT();
  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            {t.landing.exampleTitle}
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            {t.landing.exampleBody}
          </p>
        </div>

        <div className="mt-12 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <BeforeAfterImage label={t.landing.before} src="/before.jpg" />
          </div>
          <ArrowRight className="hidden md:block w-8 h-8 text-gray-300 shrink-0" />
          <div className="flex-1 w-full">
            <BeforeAfterImage label={t.landing.after} src="/after.png" accent />
          </div>
        </div>
      </div>
    </section>
  );
}

function BeforeAfterImage({ label, src, accent }: { label: string; src: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border overflow-hidden bg-white ${accent ? 'border-gray-900 shadow-md' : 'border-gray-200'}`}>
      <div className="relative aspect-[3/2]">
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        <span
          className={`absolute top-3 left-3 px-2.5 py-1 text-[11px] font-bold rounded-full ${
            accent ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-900 border border-gray-200'
          }`}
        >
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  const { t } = useT();
  const items = [
    { Icon: Layers, title: t.landing.feature1Title, body: t.landing.feature1Body },
    { Icon: Zap, title: t.landing.feature2Title, body: t.landing.feature2Body },
    { Icon: Clock, title: t.landing.feature3Title, body: t.landing.feature3Body },
  ];
  return (
    <section className="border-b border-gray-100 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {items.map(({ Icon, title, body }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-200 p-6">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(137,243,54,0.12)' }}
              >
                <Icon className="w-5 h-5" style={{ color: BRAND_GREEN }} />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── More Tools ──────────────────────────────────────────────────────────────

function MoreTools({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  const tools = [
    {
      Icon: MessageSquare,
      name: t.landing.growthManagerName,
      desc: t.landing.growthManagerDesc,
      cta: t.landing.growthManagerCta,
      badge: null,
    },
    {
      Icon: Target,
      name: t.landing.leadSearchName,
      desc: t.landing.leadSearchDesc,
      cta: t.landing.leadSearchCta,
      badge: t.landing.leadSearchBadge,
    },
    {
      Icon: LayoutGrid,
      name: t.landing.catalogueName,
      desc: t.landing.catalogueDesc,
      cta: t.landing.catalogueCta,
      badge: null,
    },
  ];

  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            {t.landing.moreToolsTitle}
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            {t.landing.moreToolsSubtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tools.map(({ Icon, name, desc, cta, badge }) => (
            <div key={name} className="flex flex-col rounded-xl border border-gray-200 p-6 bg-white">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 shrink-0"
                style={{ backgroundColor: 'rgba(137,243,54,0.12)' }}
              >
                <Icon className="w-5 h-5" style={{ color: BRAND_GREEN }} />
              </div>

              <div className="flex items-start gap-2 mb-2">
                <h3 className="text-base font-semibold text-gray-900">{name}</h3>
                {badge && (
                  <span className="shrink-0 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {badge}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 leading-relaxed flex-1">{desc}</p>

              <button
                onClick={onClick}
                className="mt-6 w-full py-2 px-4 rounded-md text-sm font-semibold border border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-all"
              >
                {cta} →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Who It's For ────────────────────────────────────────────────────────────

function WhoItsFor() {
  const { t } = useT();
  const items = [
    { Icon: Store, text: t.landing.who1 },
    { Icon: User, text: t.landing.who2 },
    { Icon: Building2, text: t.landing.who3 },
  ];
  return (
    <section className="border-b border-gray-100 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
          {t.landing.whoTitle}
        </h2>
        <ul className="mt-8 space-y-4">
          {items.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-base text-gray-700">
              <Icon className="w-5 h-5 shrink-0" style={{ color: BRAND_GREEN }} />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  const cheapest = Math.min(...TOPUP_PACKS.map((p) => p.price_usd / p.credits));

  const PACK_COPY: Record<string, { tagline: string; bullets: string[] }> = {
    basic: {
      tagline: t.landing.pricingTaglineBasic,
      bullets: [t.landing.pricingBulletBasicGen, t.landing.pricingBulletBasicStyles, t.landing.pricingBulletBasicUgc],
    },
    pro: {
      tagline: t.landing.pricingTaglinePro,
      bullets: [t.landing.pricingBulletProGen, t.landing.pricingBulletProQueue, t.landing.pricingBulletProStyles],
    },
    ultra: {
      tagline: t.landing.pricingTaglineUltra,
      bullets: [
        t.landing.pricingBulletUltraGen,
        t.landing.pricingBulletUltraQueue,
        t.landing.pricingBulletUltraPrice,
        t.landing.pricingBulletUltraStyles,
      ],
    },
  };

  return (
    <section className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            {t.landing.pricingTitle}
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            {t.landing.pricingSubtitle}{' '}
            <span className="font-semibold text-gray-900">{t.landing.pricingCredits}</span>.
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
                    {t.landing.bestValue}
                  </span>
                )}

                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  {pack.name ?? pack.id}
                </h3>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
                    ${pack.price_usd.toFixed(0)}
                  </span>
                  <span className="text-sm text-gray-500">{t.landing.oneTime}</span>
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
                  {interpolate(t.landing.getPack, { name: pack.name ?? pack.id })}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          {t.landing.payAsYouGo}
        </p>
      </div>
    </section>
  );
}

// ─── Trust ───────────────────────────────────────────────────────────────────

function Trust() {
  const { t } = useT();
  return (
    <section style={{ backgroundColor: BRAND_GREEN }}>
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          {t.landing.trustTitle}
        </h2>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <section className="bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
          {t.landing.ctaTitle}
        </h2>
        <button
          onClick={onClick}
          style={{ backgroundColor: BRAND_GREEN }}
          className="mt-8 text-sm font-semibold text-gray-900 hover:brightness-95 rounded-md px-6 py-3 transition-all shadow-sm"
        >
          {t.landing.ctaButton}
        </button>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const { t } = useT();
  return (
    <footer className="bg-gray-950 border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between text-sm text-gray-500">
        <span>Qasynda</span>
        <nav className="flex items-center gap-6">
          <a href="#" className="hover:text-white transition-colors">{t.landing.footerPrivacy}</a>
          <a href="#" className="hover:text-white transition-colors">{t.landing.footerContact}</a>
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
  const { t } = useT();
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
          {tab === 'signin' ? t.auth.signinTitle : t.auth.registerTitle}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {tab === 'signin' ? t.auth.signinSubtitle : t.auth.registerSubtitle}
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
            {t.auth.signIn}
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
            {t.auth.register}
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
                placeholder={t.auth.firstName}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50"
              />
              <input
                type="text"
                required
                maxLength={100}
                placeholder={t.auth.lastName}
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
            placeholder={t.auth.email}
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
            placeholder={tab === 'register' ? t.auth.passwordMin : t.auth.password}
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
              ? tab === 'signin' ? t.auth.signingIn : t.auth.creatingAccount
              : tab === 'signin' ? t.auth.signIn : t.auth.createAccount}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-5 w-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          {t.auth.cancel}
        </button>
      </div>
    </div>
  );
}
