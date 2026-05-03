export type LeadCampaignStatus =
  | 'pending'
  | 'selecting_channels'
  | 'refused'
  | 'discovering'
  | 'enriching'
  | 'completed'
  | 'failed';

export interface IcpInput {
  role: string;
  problem: string;
  keywords: string[];
  notes: string;
}

export interface ChannelPick {
  channel: 'reddit' | 'youtube' | 'hackernews';
  reason: string;
  confidence: number;
  subreddits?: string[];
  youtube_queries?: string[];
  hn_queries?: string[];
}

export interface Lead {
  id: string;
  campaign_id: string;
  round: number;
  platform: string;
  author_handle: string;
  author_url: string | null;
  post_url: string;
  post_text: string;
  post_created_at: string | null;
  signal_type: string;
  signal_quote: string;
  intent_score: number;
  enriched_role: string | null;
  enriched_company: string | null;
  enriched_niche: string | null;
  suggested_angle: string | null;
  created_at: string;
}

export interface LeadCampaignSummary {
  id: string;
  status: LeadCampaignStatus;
  progress: number;
  progress_label: string;
  icp: IcpInput;
  selected_channels: ChannelPick[] | null;
  leads_target: number;
  leads_found: number;
  rounds: number;
  credits_charged: number;
  error_message: string | null;
  refused_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadCampaignDetail extends LeadCampaignSummary {
  leads: Lead[];
}

export interface LeadCampaignsListResponse {
  items: LeadCampaignSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface LeadCampaignStartResponse {
  campaign_id: string;
  status: LeadCampaignStatus;
}

export const ACTIVE_STATUSES: ReadonlySet<LeadCampaignStatus> = new Set([
  'pending',
  'selecting_channels',
  'discovering',
  'enriching',
]);
