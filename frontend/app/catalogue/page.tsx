'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Layers, Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { api } from '@/lib/api';
import { useT, interpolate } from '@/lib/i18n';
import type { CatalogueListItem, CataloguesListResponse } from '@/lib/types';

const POLL_INTERVAL_MS = 5000;

function isInProgress(c: CatalogueListItem): boolean {
  return c.completed + c.failed < c.total_items;
}

export default function CataloguePage() {
  const { t } = useT();
  const router = useRouter();
  const [catalogues, setCatalogues] = useState<CatalogueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    try {
      const data = await api.get<CataloguesListResponse>('/catalogue?limit=50');
      if (!mountedRef.current) return;
      setCatalogues(data.items);
      setError(null);
      clearTimer();
      if (data.items.some(isInProgress)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : t.catalogue.loading);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void poll();
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [poll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.catalogue.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t.catalogue.subtitle}</p>
          </div>
          <Link
            href="/catalogue/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.catalogue.newCatalogue}
          </Link>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-400 text-sm">{t.catalogue.loading}</div>
        )}

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            {error}
          </p>
        )}

        {!loading && catalogues.length === 0 && !error && (
          <div className="text-center py-20">
            <Layers className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-4">{t.catalogue.noCatalogues}</p>
            <Link
              href="/catalogue/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.catalogue.createFirst}
            </Link>
          </div>
        )}

        {catalogues.length > 0 && (
          <div className="space-y-3">
            {catalogues.map((c) => (
              <CatalogueRow key={c.id} catalogue={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CatalogueRow({ catalogue }: { catalogue: CatalogueListItem }) {
  const { t, locale } = useT();
  const done = catalogue.completed + catalogue.failed;
  const pct = catalogue.total_items > 0 ? Math.round((done / catalogue.total_items) * 100) : 0;
  const inProgress = isInProgress(catalogue);

  const date = new Date(catalogue.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Link
      href={`/catalogue/${catalogue.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all px-5 py-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 truncate">
              {catalogue.name ?? <span className="text-gray-400 italic">{t.catalogue.untitled}</span>}
            </span>
            {inProgress ? (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {t.catalogue.inProgress}
              </span>
            ) : catalogue.failed > 0 && catalogue.completed === 0 ? (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                {t.catalogue.failed}
              </span>
            ) : catalogue.failed > 0 ? (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                {t.catalogue.partial}
              </span>
            ) : (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                {t.catalogue.complete}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {interpolate(t.catalogue.imagesDone, { done: catalogue.completed, total: catalogue.total_items })} · {catalogue.settings.style} · {date}
          </p>

          {inProgress && (
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full max-w-xs">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 shrink-0 transition-colors" />
      </div>
    </Link>
  );
}
