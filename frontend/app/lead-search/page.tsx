'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Plus, Target } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { leadApi } from './lib/leadApi';
import { ACTIVE_STATUSES, type LeadCampaignSummary } from './lib/leadTypes';

const POLL_INTERVAL_MS = 5000;

export default function LeadSearchPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load campaigns.');
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
              <Target className="w-7 h-7 text-indigo-600" />
              Lead Search
            </h1>
            <p className="text-sm text-gray-500 mt-2 max-w-2xl">
              Describe your ideal customer. Our AI picks the best free channels
              (Reddit, YouTube, Hacker News) where they actually post buying
              signals — and surfaces the high-intent ones for you.
            </p>
          </div>
          <Link
            href="/lead-search/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            New campaign
          </Link>
        </div>

        {error ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-500">Loading campaigns…</p>
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
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
      <Target className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900">No campaigns yet</h3>
      <p className="text-sm text-gray-500 mt-1 mb-5 max-w-sm mx-auto">
        Start by describing your ICP. We&apos;ll analyze it and refund your
        credits if no free channel fits.
      </p>
      <Link
        href="/lead-search/new"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Create your first campaign
      </Link>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: LeadCampaignSummary }) {
  const isActive = ACTIVE_STATUSES.has(campaign.status);
  return (
    <Link
      href={`/lead-search/${campaign.id}`}
      className="group block p-5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all"
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
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 mt-1 shrink-0" />
      </div>

      {isActive ? (
        <div className="mt-3">
          <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span>{campaign.progress_label || 'Working…'}</span>
            <span>{campaign.progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${campaign.progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-3">
          <span>
            {campaign.leads_found} / {campaign.leads_target} leads
          </span>
          {campaign.credits_charged > 0 ? (
            <span>· {campaign.credits_charged} credits</span>
          ) : null}
        </div>
      )}
    </Link>
  );
}

function StatusPill({ status }: { status: LeadCampaignSummary['status'] }) {
  const config: Record<LeadCampaignSummary['status'], { label: string; cls: string }> = {
    pending: { label: 'Queued', cls: 'bg-gray-100 text-gray-700' },
    selecting_channels: { label: 'Picking channels', cls: 'bg-indigo-50 text-indigo-700' },
    discovering: { label: 'Scanning', cls: 'bg-indigo-50 text-indigo-700' },
    enriching: { label: 'Scoring', cls: 'bg-indigo-50 text-indigo-700' },
    completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
    refused: { label: 'Refunded · weak signal', cls: 'bg-amber-50 text-amber-700' },
    failed: { label: 'Failed · refunded', cls: 'bg-red-50 text-red-700' },
  };
  const { label, cls } = config[status];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{label}</span>
  );
}
