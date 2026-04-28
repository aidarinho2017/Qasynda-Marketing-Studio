'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import GenerationsGallery from '@/components/GenerationsGallery';
import { isAuthenticated } from '@/lib/auth';

export default function HistoryPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All your generations across Marketplace and UGC.
          </p>
        </div>

        <GenerationsGallery showRefreshButton showCount />
      </main>
    </div>
  );
}
