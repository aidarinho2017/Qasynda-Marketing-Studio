'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BarChart2, Layers, Users, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface AdminStats {
  total_users: number;
  total_generations: number;
  total_catalogues: number;
  generations_by_status: Record<string, number>;
  generations_by_type: Record<string, number>;
  recent_failures: Array<{
    id: string;
    type: string;
    user_email: string;
    user_name: string;
    error_message: string | null;
    created_at: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  completed:  'text-green-700 bg-green-50 border-green-100',
  pending:    'text-amber-700 bg-amber-50 border-amber-100',
  processing: 'text-blue-700 bg-blue-50 border-blue-100',
  failed:     'text-red-700 bg-red-50 border-red-100',
};

export default function AdminDashboard() {
  const { t, locale } = useT();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const TYPE_LABELS: Record<string, string> = {
    marketplace: t.admin.typeMarketplace,
    ugc: t.admin.typeUgc,
    enhance: t.admin.typeEnhance,
    mini_app: t.admin.typeMiniApp,
    listing_pack: t.admin.typeListingPack,
  };

  useEffect(() => {
    api.get<AdminStats>('/admin/stats')
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Page><div className="text-gray-400 text-sm">{t.admin.loading}</div></Page>;
  if (error || !stats) return <Page><div className="text-red-500 text-sm">{error ?? t.admin.failedToLoad}</div></Page>;

  const totalGens = stats.total_generations;

  return (
    <Page>
      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard icon={<Users className="w-5 h-5 text-brand-600" />} label={t.admin.totalUsers} value={stats.total_users} />
        <MetricCard icon={<Zap className="w-5 h-5 text-brand-600" />} label={t.admin.totalGenerations} value={stats.total_generations} />
        <MetricCard icon={<Layers className="w-5 h-5 text-brand-600" />} label={t.admin.catalogues} value={stats.total_catalogues} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* By status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t.admin.byStatus}</h2>
          <div className="space-y-2">
            {Object.entries(stats.generations_by_status).map(([s, n]) => (
              <div key={s} className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[s] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                  {s}
                </span>
                <div className="flex items-center gap-2 ml-3 flex-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: totalGens ? `${(n / totalGens) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 tabular-nums w-10 text-right">{n}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By type */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t.admin.byType}</h2>
          <div className="space-y-2">
            {Object.entries(stats.generations_by_type).map(([tp, n]) => (
              <div key={tp} className="flex items-center justify-between">
                <span className="text-xs text-gray-500 w-28 shrink-0">{TYPE_LABELS[tp] ?? tp}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: totalGens ? `${(n / totalGens) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 tabular-nums w-10 text-right">{n}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent failures */}
      {stats.recent_failures.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            {t.admin.recentFailures}
          </h2>
          <div className="divide-y divide-gray-50">
            {stats.recent_failures.map((f) => (
              <div key={f.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{f.user_email}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{f.error_message ?? t.admin.noErrorMessage}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-gray-400">{TYPE_LABELS[f.type] ?? f.type}</span>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {new Date(f.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-8">
        <BarChart2 className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">{t.admin.dashboard}</h1>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
      <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value.toLocaleString()}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
