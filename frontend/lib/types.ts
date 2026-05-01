export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  credits_balance: number;
  created_at: string;
}

export interface TopupPack {
  id: string;
  credits: number;
  price_usd: number;
  name?: string;
}

export interface TopupResponse {
  credits_balance: number;
  credits_added: number;
  price_usd: number;
  pack_id: string;
}

export type ListingImageType = 'hero' | 'benefit' | 'use_case' | 'details' | 'final';

export interface ListingImage {
  type: ListingImageType;
  index: number;
  url: string;
}

export interface ListingContentPlan {
  title: string;
  category?: string;
  benefits: string[];
  use_case: string;
  details: string[];
  final_message: string;
}

export interface Generation {
  id: string;
  type: 'marketplace' | 'ugc' | 'enhance' | 'mini_app' | 'listing_pack';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_data: Record<string, unknown>;
  source_image_url: string;
  // Either flat URL strings (legacy types) or rich {type,index,url} objects (listing_pack).
  image_urls: (string | ListingImage)[];
  prompt_used: string | null;
  error_message: string | null;
  content_plan?: ListingContentPlan | null;
  created_at: string;
  updated_at: string;
}

export function imageUrlOf(entry: string | ListingImage): string {
  return typeof entry === 'string' ? entry : entry.url;
}

export interface GenerationsListResponse {
  items: Generation[];
  total: number;
  limit: number;
  offset: number;
}

export interface GenerationStartResponse {
  generation_id: string;
  status: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
