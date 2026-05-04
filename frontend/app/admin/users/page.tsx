'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useT, interpolate } from '@/lib/i18n';

interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  credits_balance: number;
  is_admin: boolean;
  generation_count: number;
  created_at: string;
}

interface AdminUsersListResponse {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 20;

export default function AdminUsersPage() {
  const { t, locale } = useT();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (q) params.set('search', q);
      const data = await api.get<AdminUsersListResponse>(`/admin/users?${params}`);
      setUsers(data.items);
      setTotal(data.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(query, offset); }, [query, offset, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  }

  const totalPages = Math.ceil(total / LIMIT);
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">{t.admin.users}</h1>
        <span className="ml-2 text-sm text-gray-400">{total} {t.admin.total}</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
        >
          {t.admin.search}
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setSearch(''); setQuery(''); setOffset(0); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {t.admin.clear}
          </button>
        )}
      </form>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.user}</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.credits}</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.generationsCol}</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.joined}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">{t.admin.loadingRows}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">{t.admin.noUsersFound}</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{u.name}</span>
                        {u.is_admin && (
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-500" aria-label="Admin" />
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-700 tabular-nums">
                  {u.credits_balance.toFixed(2)}
                </td>
                <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{u.generation_count}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(u.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
