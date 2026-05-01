export type CoachModule =
  | 'foundation'
  | 'acquisition'
  | 'content'
  | 'outreach'
  | 'funnel';

export const V1_MODULES: ReadonlySet<CoachModule> = new Set(['foundation', 'acquisition']);

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured_output: {
    structured?: Record<string, unknown>;
    next_actions?: NextAction[];
  } | null;
  module: CoachModule | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  current_module: CoachModule;
  last_message_at: string | null;
  updated_at: string;
}

export interface ConversationOut {
  id: string;
  title: string;
  current_module: CoachModule;
  context: Record<string, unknown>;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  messages: CoachMessage[];
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  total: number;
}

export interface NextAction {
  label: string;
  module: CoachModule;
  prompt: string;
}

export interface AssistantTurnResponse {
  message: CoachMessage;
  reply: string;
  structured: Record<string, unknown>;
  context_updates: Record<string, unknown>;
  next_actions: NextAction[];
  conversation_context: Record<string, unknown>;
  credits_balance: number;
}

// ─── Module-specific structured shapes (v1) ──────────────────────────────

export interface FoundationICP {
  who: string;
  age_range: string;
  where: string;
  pains: string[];
  jobs_to_be_done: string[];
}

export interface FoundationOffer {
  headline: string;
  value_props: string[];
  price_anchor: string;
  guarantee: string;
}

export interface FoundationStructured {
  product_summary: string;
  icp: FoundationICP;
  offer: FoundationOffer;
  positioning_angle: string;
  validation_questions: string[];
}

export interface AcquisitionAdHook {
  hook: string;
  angle: string;
  format_hint: 'static' | 'video' | 'carousel';
}

export interface AcquisitionStructured {
  ad_hooks: AcquisitionAdHook[];
  primary_caption: string;
  short_caption: string;
  ctas: string[];
  visual_brief: string;
}
