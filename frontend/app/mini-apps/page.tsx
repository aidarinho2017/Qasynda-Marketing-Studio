'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Sparkles, Smile, Crown } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function MiniAppsPage() {
  const { t } = useT();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-brand-600 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">{t.miniApps.label}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t.miniApps.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.miniApps.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MiniAppCard
            href="/mini-apps/fat-maker"
            icon={<Smile className="w-6 h-6 text-brand-600" />}
            title={t.miniApps.fatMakerTitle}
            description={t.miniApps.fatMakerDesc}
          />
          <MiniAppCard
            href="/mini-apps/chess"
            icon={<Crown className="w-6 h-6 text-brand-600" />}
            title={t.miniApps.chessTitle}
            description={t.miniApps.chessDesc}
          />
        </div>
      </main>
    </div>
  );
}

function OpenLabel() {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
      {t.miniApps.open}
      <ArrowRight className="w-4 h-4" />
    </span>
  );
}

function MiniAppCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all"
    >
      <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-4">{description}</p>
      <OpenLabel />
    </Link>
  );
}
