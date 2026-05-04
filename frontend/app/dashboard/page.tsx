'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Layers } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function DashboardPage() {
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t.dashboard.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.dashboard.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ChoiceCard
            href="/generate?mode=marketplace"
            image="/dashboard pictures/marketplaceimages.png"
            title={t.dashboard.marketplaceTitle}
            description={t.dashboard.marketplaceDesc}
          />
          <ChoiceCard
            href="/generate?mode=ugc"
            image="/dashboard pictures/ugc.png"
            title={t.dashboard.ugcTitle}
            description={t.dashboard.ugcDesc}
          />
          <ChoiceCard
            href="/generate?mode=enhance"
            image="/dashboard pictures/enhance.png"
            title={t.dashboard.enhanceTitle}
            description={t.dashboard.enhanceDesc}
          />
          <ChoiceCard
            href="/generate/listing-pack"
            image="/dashboard pictures/productlising.png"
            title={t.dashboard.listingPackTitle}
            description={t.dashboard.listingPackDesc}
          />
          <ChoiceCard
            href="/growth-manager"
            image="/dashboard pictures/aigrowthmanager.png"
            title={t.dashboard.growthTitle}
            description={t.dashboard.growthDesc}
          />
          <ChoiceCard
            href="/lead-search"
            image="/dashboard pictures/leadsearch.png"
            title={t.dashboard.leadSearchTitle}
            description={t.dashboard.leadSearchDesc}
          />
          <CatalogueCard />
        </div>
      </main>
    </div>
  );
}

function CatalogueCard() {
  const { t } = useT();
  return (
    <Link
      href="/catalogue"
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all overflow-hidden"
    >
      <div className="relative w-full h-40 bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center overflow-hidden">
        <Layers className="w-16 h-16 text-white/20 group-hover:scale-110 transition-transform duration-300" />
        <span className="absolute bottom-3 right-3 text-xs text-white/50 font-medium">{t.dashboard.upTo20}</span>
      </div>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t.dashboard.catalogueTitle}</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">
          {t.dashboard.catalogueDesc}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
          {t.dashboard.start}
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

function ChoiceCard({
  href,
  image,
  title,
  description,
}: {
  href: string;
  image: string;
  title: string;
  description: string;
}) {
  const { t } = useT();
  return (
    <Link
      href={href}
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all overflow-hidden"
    >
      <div className="relative w-full h-40 overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">{description}</p>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
          {t.dashboard.start}
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
