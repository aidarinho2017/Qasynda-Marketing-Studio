'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import GenerationCard from '@/components/GenerationCard';
import { isAuthenticated } from '@/lib/auth';
import { api } from '@/lib/api';
import { useT, interpolate } from '@/lib/i18n';
import type { CatalogueDetail } from '@/lib/types';

const POLL_INTERVAL_MS = 5000;

export default function CatalogueDetailPage() {
  const { t } = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [catalogue, setCatalogue] = useState<CatalogueDetail | null>(null);
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
    if (!id) return;
    try {
      const data = await api.get<CatalogueDetail>(`/catalogue/${id}`);
      if (!mountedRef.current) return;
      setCatalogue(data);
      setError(null);
      clearTimer();
      const done = data.completed + data.failed;
      if (done < data.total_items) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : t.catalogue.loading);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    mountedRef.current = true;
    void poll();
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [poll]);

  async function handleDelete(generationId: string) {
    await api.delete(`/generations/${generationId}`);
    setCatalogue((prev) =>
      prev
        ? {
            ...prev,
            generations: prev.generations.filter((g) => g.id !== generationId),
            total_items: prev.total_items - 1,
            completed: prev.generations.find((g) => g.id === generationId)?.status === 'completed'
              ? prev.completed - 1
              : prev.completed,
            failed: prev.generations.find((g) => g.id === generationId)?.status === 'failed'
              ? prev.failed - 1
              : prev.failed,
          }
        : prev,
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (error || !catalogue) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showUserMenu />
        <main className="max-w-4xl mx-auto px-4 pt-24">
          <p className="text-sm text-red-500">{error ?? t.catalogue.notFound}</p>
          <Link href="/catalogue" className="text-sm text-brand-600 underline mt-2 inline-block">
            ← {t.catalogue.backToAll}
          </Link>
        </main>
      </div>
    );
  }

  const done = catalogue.completed + catalogue.failed;
  const pct = catalogue.total_items > 0 ? Math.round((done / catalogue.total_items) * 100) : 0;
  const isComplete = done >= catalogue.total_items;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.catalogue.backToAll}
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {catalogue.name ?? t.catalogue.untitled}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {catalogue.settings.style} · {catalogue.settings.layout} · {interpolate(t.catalogue.creativity10, { n: catalogue.settings.creativity })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isComplete && <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />}
              <span className="text-sm font-medium text-gray-700">
                {interpolate(t.catalogue.detailOf, { done: catalogue.completed, total: catalogue.total_items })}
                {catalogue.failed > 0 && (
                  <span className="ml-1.5 text-red-500">{interpolate(t.catalogue.failedCount, { n: catalogue.failed })}</span>
                )}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Generation grid */}
        {catalogue.generations.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {t.catalogue.noGenerations}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {catalogue.generations.map((g) => (
              <GenerationCard key={g.id} generation={g} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
