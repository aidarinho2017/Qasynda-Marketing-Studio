'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { useT, interpolate } from '@/lib/i18n';

interface AdminGenerationItem {
  id: string;
  type: string;
  status: string;
  user_email: string;
  user_name: string;
  created_at: string;
  error_message: string | null;
}

interface AdminGenerationsListResponse {
  items: AdminGenerationItem[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 20;

const STATUS_STYLES: Record<string, string> = {
  completed:  'bg-green-50 text-green-700 border-green-100',
  pending:    'bg-amber-50 text-amber-700 border-amber-100',
  processing: 'bg-blue-50 text-blue-700 border-blue-100',
  failed:     'bg-red-50 text-red-700 border-red-100',
};

const STATUSES = ['', 'completed', 'failed', 'pending', 'processing'];
const TYPES = ['', 'marketplace', 'ugc', 'enhance', 'listing_pack', 'mini_app'];

export default function AdminGenerationsPage() {
  const { t, locale } = useT();

  const TYPE_LABELS: Record<string, string> = {
    marketplace: t.admin.typeMarketplace,
    ugc: t.admin.typeUgc,
    enhance: t.admin.typeEnhance,
    mini_app: t.admin.typeMiniApp,
    listing_pack: t.admin.typeListingPack,
  };

  const [items, setItems] = useState<AdminGenerationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: string, type: string, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      const data = await api.get<AdminGenerationsListResponse>(`/admin/generations?${params}`);
      setItems(data.items);
      setTotal(data.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load generations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filterStatus, filterType, offset); }, [filterStatus, filterType, offset, load]);

  function handleFilterChange(status: string, type: string) {
    setOffset(0);
    setFilterStatus(status);
    setFilterType(type);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">{t.admin.generations}</h1>
        <span className="ml-2 text-sm text-gray-400">{total} {t.admin.total}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => handleFilterChange(e.target.value, filterType)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : t.admin.allStatuses}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => handleFilterChange(filterStatus, e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white"
        >
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>{tp ? (TYPE_LABELS[tp] ?? tp) : t.admin.allTypes}</option>
          ))}
        </select>
        {(filterStatus || filterType) && (
          <button
            onClick={() => handleFilterChange('', '')}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {t.admin.clearFilters}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.status}</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.type}</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.user}</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.date}</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.error}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">{t.admin.loading}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">{t.admin.noGenerationsFound}</td></tr>
            ) : items.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[g.status] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                    {g.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">{TYPE_LABELS[g.type] ?? g.type}</td>
                <td className="px-5 py-3">
                  <div>
                    <span className="text-gray-900">{g.user_name}</span>
                    <p className="text-xs text-gray-400">{g.user_email}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {new Date(g.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-3 text-xs text-red-400 max-w-xs truncate">
                  {g.error_message ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{interpolate(t.admin.page, { n: page, total: totalPages })}</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.admin.previous}
            </button>
            <button
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset(offset + LIMIT)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.admin.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
