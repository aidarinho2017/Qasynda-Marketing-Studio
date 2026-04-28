'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Film, LayoutGrid } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            What do you want to create?
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pick a mode to get started. You can switch modes anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChoiceCard
            href="/generate?mode=marketplace"
            icon={<LayoutGrid className="w-6 h-6 text-indigo-600" />}
            title="Marketplace Images"
            description="Generate product cards for Wildberries, Ozon, Kaspi and other marketplaces."
          />
          <ChoiceCard
            href="/generate?mode=ugc"
            icon={<Film className="w-6 h-6 text-indigo-600" />}
            title="UGC Images"
            description="Realistic, social-style imagery showing your product being used."
          />
        </div>
      </main>
    </div>
  );
}

function ChoiceCard({
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
      className="group block p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
    >
      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">{description}</p>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 group-hover:gap-2 transition-all">
        Start
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}
