'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Plus, Target } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { useT, interpolate } from '@/lib/i18n';
import { leadApi } from './lib/leadApi';
import { ACTIVE_STATUSES, type LeadCampaignSummary } from './lib/leadTypes';

const POLL_INTERVAL_MS = 5000;

export default function LeadSearchPage() {
  const { t } = useT();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<LeadCampaignSummary[]>([]);
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
      const data = await leadApi.list();
      if (!mountedRef.current) return;
      setCampaigns(data.items);
      setError(null);
      clearTimer();
      const hasActive = data.items.some((c) => ACTIVE_STATUSES.has(c.status));
      if (hasActive) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : t.leadSearch.loadingCampaigns);
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Target className="w-7 h-7 text-brand-600" />
              {t.leadSearch.title}
            </h1>
            <p className="text-sm text-gray-500 mt-2 max-w-2xl">
              {t.leadSearch.subtitle}
            </p>
          </div>
          <Link
            href="/lead-search/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t.leadSearch.newCampaign}
          </Link>
        </div>

        {error ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-500">{t.leadSearch.loadingCampaigns}</p>
        ) : campaigns.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((c) => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  const { t } = useT();
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
      <Target className="w-10 h-10 text-brand-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900">{t.leadSearch.noCampaignsTitle}</h3>
      <p className="text-sm text-gray-500 mt-1 mb-5 max-w-sm mx-auto">
        {t.leadSearch.noCampaignsBody}
      </p>
      <Link
        href="/lead-search/new"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        {t.leadSearch.createFirst}
      </Link>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: LeadCampaignSummary }) {
  const isActive = ACTIVE_STATUSES.has(campaign.status);
  return (
    <Link
      href={`/lead-search/${campaign.id}`}
      className="group block p-5 bg-white rounded-xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusPill status={campaign.status} />
            <span className="text-xs text-gray-400">
              {new Date(campaign.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">
            {campaign.icp.role || 'Untitled ICP'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {campaign.icp.problem}
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 mt-1 shrink-0" />
      </div>

      <CampaignProgress campaign={campaign} isActive={isActive} />
    </Link>
  );
}

function CampaignProgress({ campaign, isActive }: { campaign: LeadCampaignSummary; isActive: boolean }) {
  const { t } = useT();
  if (isActive) {
    return (
      <div className="mt-3">
        <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
          <span>{campaign.progress_label || t.leadSearch.working}</span>
          <span>{campaign.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${campaign.progress}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 text-xs text-gray-500 flex items-center gap-3">
      <span>{interpolate(t.leadSearch.leadsFound, { found: campaign.leads_found, target: campaign.leads_target })}</span>
      {campaign.credits_charged > 0 ? (
        <span>{interpolate(t.leadSearch.creditsCharged, { n: campaign.credits_charged })}</span>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: LeadCampaignSummary['status'] }) {
  const { t } = useT();
  const config: Record<LeadCampaignSummary['status'], { label: string; cls: string }> = {
    pending: { label: t.leadSearch.statusQueued, cls: 'bg-gray-100 text-gray-700' },
    selecting_channels: { label: t.leadSearch.statusPickingChannels, cls: 'bg-brand-50 text-brand-700' },
    discovering: { label: t.leadSearch.statusScanning, cls: 'bg-brand-50 text-brand-700' },
    enriching: { label: t.leadSearch.statusScoring, cls: 'bg-brand-50 text-brand-700' },
    completed: { label: t.leadSearch.statusCompleted, cls: 'bg-emerald-50 text-emerald-700' },
    refused: { label: t.leadSearch.statusRefused, cls: 'bg-amber-50 text-amber-700' },
    failed: { label: t.leadSearch.statusFailed, cls: 'bg-red-50 text-red-700' },
  };
  const { label, cls } = config[status];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{label}</span>
  );
}
