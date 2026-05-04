'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import GenerationsGallery from '@/components/GenerationsGallery';
import { isAuthenticated } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function HistoryPage() {
  const { t } = useT();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t.history.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t.history.subtitle}
          </p>
        </div>

        <GenerationsGallery showRefreshButton showCount />
      </main>
    </div>
  );
}
