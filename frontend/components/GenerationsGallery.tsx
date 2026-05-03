'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import GenerationCard from '@/components/GenerationCard';
import { api } from '@/lib/api';
import type { Generation, GenerationsListResponse } from '@/lib/types';

export interface GenerationsGalleryHandle {
  refetch: () => Promise<void>;
}

interface GenerationsGalleryProps {
  limit?: number;
  gridClassName?: string;
  showRefreshButton?: boolean;
  showCount?: boolean;
}

const POLL_INTERVAL_MS = 5000;

const GenerationsGallery = forwardRef<GenerationsGalleryHandle, GenerationsGalleryProps>(
  function GenerationsGallery(
    {
      limit = 50,
      gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
      showRefreshButton = false,
      showCount = false,
    },
    ref,
  ) {
    const router = useRouter();
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fetchOnce = useCallback(async () => {
      try {
        const data = await api.get<GenerationsListResponse>(`/generations?limit=${limit}`);
        if (!mountedRef.current) return data;
        setGenerations(data.items);
        setError(null);
        return data;
      } catch (err) {
        if (!mountedRef.current) throw err;
        setError(err instanceof Error ? err.message : 'Failed to load generations.');
        throw err;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }, [limit]);

    const poll = useCallback(async () => {
      try {
        const data = await fetchOnce();
        if (!mountedRef.current) return;
        const hasActive = data.items.some(
          (g) => g.status === 'pending' || g.status === 'processing',
        );
        clearTimer();
        if (hasActive) {
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        // error already surfaced via state
      }
    }, [fetchOnce]);

    useImperativeHandle(
      ref,
      () => ({
        refetch: async () => {
          await poll();
        },
      }),
      [poll],
    );

    useEffect(() => {
      mountedRef.current = true;
      poll();
      return () => {
        mountedRef.current = false;
        clearTimer();
      };
    }, [poll]);

    const handleDelete = async (id: string) => {
      await api.delete(`/generations/${id}`);
      setGenerations((prev) => prev.filter((g) => g.id !== id));
    };

    return (
      <div>
        {(showRefreshButton || showCount) && (
          <div className="flex items-center justify-between mb-4">
            {showCount ? (
              <p className="text-sm text-gray-500">
                {generations.length} generation{generations.length !== 1 ? 's' : ''}
              </p>
            ) : (
              <span />
            )}
            {showRefreshButton && (
              <button
                onClick={() => poll()}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white border border-gray-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className={gridClassName}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
              >
                <div className="aspect-video bg-gray-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => poll()}
              className="mt-4 text-sm text-brand-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && generations.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100">
            <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plus className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">No generations yet</h3>
            <p className="text-sm text-gray-400 mb-6">
              Create your first AI image to get started.
            </p>
            <button
              onClick={() => router.push('/generate?mode=marketplace')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Generation
            </button>
          </div>
        )}

        {!loading && !error && generations.length > 0 && (
          <div className={gridClassName}>
            {generations.map((g) => (
              <GenerationCard key={g.id} generation={g} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default GenerationsGallery;
