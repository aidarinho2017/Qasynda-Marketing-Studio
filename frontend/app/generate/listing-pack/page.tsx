'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UploadForm from '@/components/UploadForm';
import GenerationsGallery, {
  type GenerationsGalleryHandle,
} from '@/components/GenerationsGallery';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import {
  LISTING_PACK_CREDITS,
  refreshCredits,
  triggerInsufficientCredits,
  useCredits,
} from '@/lib/credits';
import { useT, interpolate } from '@/lib/i18n';
import type { GenerationStartResponse } from '@/lib/types';

type Marketplace = 'kaspi' | 'wildberries';

export default function ListingPackPage() {
  const { t } = useT();
  const router = useRouter();
  const galleryRef = useRef<GenerationsGalleryHandle>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [benefits, setBenefits] = useState('');
  const [marketplace, setMarketplace] = useState<Marketplace>('kaspi');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert(t.listingPack.alertUpload);
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append('image', file);
    if (title.trim()) fd.append('title', title.trim());
    if (benefits.trim()) fd.append('benefits', benefits.trim());
    fd.append('marketplace', marketplace);

    try {
      await api.post<GenerationStartResponse>('/generate/listing-pack', fd);
      setFile(null);
      setTitle('');
      setBenefits('');
      await Promise.all([galleryRef.current?.refetch(), refreshCredits()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.listingPack.generating);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.listingPack.backToDashboard}
        </button>

        <div className="mb-8 flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.listingPack.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t.listingPack.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-8">
          {/* Form */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.listingPack.productPhoto}
                </label>
                <UploadForm onFile={setFile} currentFile={file} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.listingPack.titleLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.listingPack.titlePH}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t.listingPack.titleHint}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.listingPack.benefitsLabel}
                </label>
                <textarea
                  rows={3}
                  placeholder={t.listingPack.benefitsPH}
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t.listingPack.benefitsHint}
                </p>
              </div>

              <MarketplaceSelector value={marketplace} onChange={setMarketplace} />

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <ListingPackSubmit submitting={submitting} fileMissing={!file} />
            </form>

            <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
              {t.listingPack.packNote}
            </p>
          </div>

          {/* Right pane: generations */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t.listingPack.yourGenerations}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.listingPack.generationsSubtitle}
              </p>
            </div>
            <GenerationsGallery
              ref={galleryRef}
              gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-4"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function MarketplaceSelector({
  value,
  onChange,
}: {
  value: Marketplace;
  onChange: (v: Marketplace) => void;
}) {
  const { t } = useT();
  const options: { id: Marketplace; label: string; hint: string }[] = [
    { id: 'kaspi', label: 'Kaspi', hint: t.listingPack.kaspiHint },
    { id: 'wildberries', label: 'Wildberries', hint: t.listingPack.wildberriesHint },
  ];
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t.listingPack.marketplaceStyle}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`text-left border rounded-xl px-3.5 py-2.5 transition-all ${
                active
                  ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-500/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
              <div className="text-xs text-gray-500">{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListingPackSubmit({
  submitting,
  fileMissing,
}: {
  submitting: boolean;
  fileMissing: boolean;
}) {
  const { t } = useT();
  const { balance } = useCredits();
  const cost = LISTING_PACK_CREDITS;
  const insufficient = balance !== null && balance < cost;

  if (insufficient) {
    return (
      <button
        type="button"
        onClick={() =>
          triggerInsufficientCredits(interpolate(t.listingPack.needCredits, { cost }))
        }
        className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
      >
        {interpolate(t.listingPack.needCredits, { cost })}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={submitting || fileMissing}
      className="w-full py-3 px-6 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
    >
      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
      {submitting
        ? t.listingPack.generating
        : (
          <>
            {t.listingPack.generatePack}
            <span className="opacity-80 font-normal">{interpolate(t.listingPack.costSuffix, { cost })}</span>
          </>
        )}
    </button>
  );
}
