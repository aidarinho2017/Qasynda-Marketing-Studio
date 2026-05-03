'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { isAuthenticated } from '@/lib/auth';
import { refreshCredits } from '@/lib/credits';
import { leadApi } from '../lib/leadApi';
import {
  ACTIVE_STATUSES,
  type ChannelPick,
  type Lead,
  type LeadCampaignDetail,
} from '../lib/leadTypes';

const POLL_INTERVAL_MS = 4000;
const TOPUP_CREDITS = 15;
const TOPUP_LEADS = 20;
const MAX_ROUNDS = 5;

type SortKey = 'score' | 'recency';
type SignalFilter = 'all' | 'looking_for' | 'complaint' | 'hiring' | 'engagement';

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [campaign, setCampaign] = useState<LeadCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const wasActiveRef = useRef(false);

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
      const data = await leadApi.get(id);
      if (!mountedRef.current) return;
      setCampaign(data);
      setError(null);
      const isActive = ACTIVE_STATUSES.has(data.status);
      // The moment a campaign settles, the navbar credit balance may have
      // changed (refund landed, or charge stuck). Refresh it.
      if (wasActiveRef.current && !isActive) {
        void refreshCredits();
      }
      wasActiveRef.current = isActive;
      clearTimer();
      if (isActive) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load campaign.');
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

  const handleDelete = async () => {
    if (!id || !campaign) return;
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await leadApi.remove(id);
      router.replace('/lead-search');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
      setDeleting(false);
    }
  };

  const handleTopup = async () => {
    if (!id || !campaign) return;
    if (
      !confirm(
        `Run another round? Costs ${TOPUP_CREDITS} credits for up to ${TOPUP_LEADS} more leads.`,
      )
    )
      return;
    setToppingUp(true);
    try {
      await leadApi.topup(id);
      void refreshCredits();
      // Optimistically flip to a "queued" state so polling resumes immediately.
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              status: 'pending',
              progress: 0,
              progress_label: 'Queued',
            }
          : prev,
      );
      wasActiveRef.current = true;
      void poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed.');
    } finally {
      setToppingUp(false);
    }
  };

  const handleExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const blob = await leadApi.exportCsv(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showUserMenu />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <Link
          href="/lead-search"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          All campaigns
        </Link>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error && !campaign ? (
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        ) : campaign ? (
          <>
            <Header
              campaign={campaign}
              onDelete={handleDelete}
              onRefresh={poll}
              onExport={handleExport}
              onTopup={handleTopup}
              deleting={deleting}
              exporting={exporting}
              toppingUp={toppingUp}
            />

            {ACTIVE_STATUSES.has(campaign.status) ? (
              <ProgressCard campaign={campaign} />
            ) : null}

            {campaign.status === 'refused' ? <RefusedCard campaign={campaign} /> : null}
            {campaign.status === 'failed' ? <FailedCard campaign={campaign} /> : null}

            {campaign.leads.length > 0 ? (
              <LeadsTable leads={campaign.leads} />
            ) : campaign.status === 'completed' && campaign.leads_found === 0 ? (
              <NoLeadsCard />
            ) : null}

            {campaign.selected_channels && campaign.selected_channels.length > 0 ? (
              <ChannelsCard channels={campaign.selected_channels} />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function Header({
  campaign,
  onDelete,
  onRefresh,
  onExport,
  onTopup,
  deleting,
  exporting,
  toppingUp,
}: {
  campaign: LeadCampaignDetail;
  onDelete: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onTopup: () => void;
  deleting: boolean;
  exporting: boolean;
  toppingUp: boolean;
}) {
  const hasLeads = campaign.leads.length > 0;
  const canTopup =
    campaign.status === 'completed' && campaign.rounds < MAX_ROUNDS;
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 truncate">
          {campaign.icp.role || 'Untitled ICP'}
        </h1>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{campaign.icp.problem}</p>
        <p className="text-xs text-gray-400 mt-2">
          Started {new Date(campaign.created_at).toLocaleString()} ·{' '}
          {campaign.leads_found} / {campaign.leads_target} leads
          {campaign.rounds > 1 ? ` · ${campaign.rounds} rounds` : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
        {canTopup ? (
          <button
            type="button"
            onClick={onTopup}
            disabled={toppingUp}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
            title={`+${TOPUP_LEADS} leads · ${TOPUP_CREDITS} credits`}
          >
            {toppingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Find more ({TOPUP_CREDITS} cr)
          </button>
        ) : campaign.status === 'completed' && campaign.rounds >= MAX_ROUNDS ? (
          <span className="text-xs text-gray-400 px-2">
            Max {MAX_ROUNDS} rounds reached
          </span>
        ) : null}
        {hasLeads ? (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export CSV
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-500 disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ProgressCard({ campaign }: { campaign: LeadCampaignDetail }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-gray-900">
          {campaign.progress_label || 'Working…'}
        </p>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${campaign.progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">{campaign.progress}%</p>
    </div>
  );
}

function RefusedCard({ campaign }: { campaign: LeadCampaignDetail }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">
            We refunded your credits
          </h3>
          <p className="text-sm text-amber-800 mt-1">
            {campaign.refused_reason ??
              "Your ICP doesn't have strong signal on the free channels we currently support."}
          </p>
          <p className="text-xs text-amber-700 mt-3">
            Try refining your ICP — narrower role, clearer problem, or different
            niche keywords. Paid channels (X, LinkedIn) are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

function FailedCard({ campaign }: { campaign: LeadCampaignDetail }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-4">
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-red-900">
            Campaign failed — credits refunded
          </h3>
          <p className="text-sm text-red-800 mt-1">
            {campaign.error_message ??
              'Something went wrong on our side. Please try again.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function NoLeadsCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-8 mb-4 text-center">
      <p className="text-sm font-medium text-gray-900">No qualifying leads found</p>
      <p className="text-xs text-gray-500 mt-1">
        We scanned the picked channels but didn&apos;t find posts that scored high
        enough on intent. If credits weren&apos;t refunded, it means the campaign
        completed normally — try a different ICP angle next time.
      </p>
    </div>
  );
}

function LeadsTable({ leads }: { leads: Lead[] }) {
  const [sort, setSort] = useState<SortKey>('score');
  const [filter, setFilter] = useState<SignalFilter>('all');
  const showRounds = useMemo(
    () => leads.some((l) => l.round > 1),
    [leads],
  );

  const filtered = useMemo(() => {
    const arr = filter === 'all' ? leads : leads.filter((l) => l.signal_type === filter);
    if (sort === 'recency') {
      return [...arr].sort((a, b) => {
        const ad = a.post_created_at ? Date.parse(a.post_created_at) : 0;
        const bd = b.post_created_at ? Date.parse(b.post_created_at) : 0;
        return bd - ad;
      });
    }
    return [...arr].sort((a, b) => b.intent_score - a.intent_score);
  }, [leads, sort, filter]);

  const counts = useMemo(() => {
    const c: Record<SignalFilter, number> = {
      all: leads.length,
      looking_for: 0,
      complaint: 0,
      hiring: 0,
      engagement: 0,
    };
    for (const l of leads) {
      const k = l.signal_type as SignalFilter;
      if (k in c) c[k] += 1;
    }
    return c;
  }, [leads]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <FilterChip
          label={`All · ${counts.all}`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterChip
          label={`Looking for · ${counts.looking_for}`}
          active={filter === 'looking_for'}
          onClick={() => setFilter('looking_for')}
          disabled={counts.looking_for === 0}
        />
        <FilterChip
          label={`Complaints · ${counts.complaint}`}
          active={filter === 'complaint'}
          onClick={() => setFilter('complaint')}
          disabled={counts.complaint === 0}
        />
        <FilterChip
          label={`Hiring · ${counts.hiring}`}
          active={filter === 'hiring'}
          onClick={() => setFilter('hiring')}
          disabled={counts.hiring === 0}
        />
        <FilterChip
          label={`Engagement · ${counts.engagement}`}
          active={filter === 'engagement'}
          onClick={() => setFilter('engagement')}
          disabled={counts.engagement === 0}
        />
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
          >
            <option value="score">Intent score</option>
            <option value="recency">Most recent</option>
          </select>
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {filtered.map((l) => (
          <LeadRow key={l.id} lead={l} showRound={showRounds} />
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
      }`}
    >
      {label}
    </button>
  );
}

function LeadRow({ lead, showRound }: { lead: Lead; showRound: boolean }) {
  const platformLabel: Record<string, string> = {
    reddit: 'Reddit',
    youtube: 'YouTube',
    hackernews: 'Hacker News',
  };
  return (
    <li className="p-4 sm:p-5 hover:bg-gray-50/60">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <ScoreBadge score={lead.intent_score} />
            <SignalBadge signal={lead.signal_type} />
            {showRound ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                R{lead.round}
              </span>
            ) : null}
            <span className="text-xs text-gray-500">
              {platformLabel[lead.platform] ?? lead.platform} · {lead.author_handle}
            </span>
            {lead.post_created_at ? (
              <span className="text-xs text-gray-400">
                {new Date(lead.post_created_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-gray-900 line-clamp-2">
            <span className="text-gray-500">“</span>
            {lead.signal_quote}
            <span className="text-gray-500">”</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {lead.enriched_role ? <span>{lead.enriched_role}</span> : null}
            {lead.enriched_company ? <span>· {lead.enriched_company}</span> : null}
            {lead.enriched_niche ? <span>· {lead.enriched_niche}</span> : null}
          </div>
          {lead.suggested_angle ? (
            <p className="mt-1.5 text-xs">
              <span className="text-gray-400">Angle: </span>
              <span className="text-indigo-700 font-medium">
                {lead.suggested_angle}
              </span>
            </p>
          ) : null}
        </div>
        <a
          href={lead.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 mt-1"
        >
          Open
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </li>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 85
      ? 'bg-emerald-100 text-emerald-800'
      : score >= 70
      ? 'bg-indigo-100 text-indigo-800'
      : 'bg-gray-100 text-gray-700';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>
      {score}
    </span>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const labels: Record<string, string> = {
    looking_for: 'Looking for',
    complaint: 'Complaint',
    hiring: 'Hiring',
    engagement: 'Engagement',
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-800">
      {labels[signal] ?? signal}
    </span>
  );
}

function ChannelsCard({ channels }: { channels: ChannelPick[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        <h3 className="text-sm font-semibold text-gray-900">
          Channels picked for your ICP
        </h3>
      </div>
      <div className="space-y-4">
        {channels.map((c) => (
          <ChannelBlock key={c.channel} pick={c} />
        ))}
      </div>
    </div>
  );
}

function ChannelBlock({ pick }: { pick: ChannelPick }) {
  const labels: Record<ChannelPick['channel'], string> = {
    reddit: 'Reddit',
    youtube: 'YouTube',
    hackernews: 'Hacker News',
  };
  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-900">{labels[pick.channel]}</p>
        <span className="text-xs text-gray-500">
          {pick.confidence}% confidence
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{pick.reason}</p>
      {pick.subreddits && pick.subreddits.length > 0 ? (
        <Pills label="Subreddits" items={pick.subreddits.map((s) => `r/${s}`)} />
      ) : null}
      {pick.youtube_queries && pick.youtube_queries.length > 0 ? (
        <Pills label="Search queries" items={pick.youtube_queries} />
      ) : null}
      {pick.hn_queries && pick.hn_queries.length > 0 ? (
        <Pills label="Signal phrases" items={pick.hn_queries} />
      ) : null}
    </div>
  );
}

function Pills({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
