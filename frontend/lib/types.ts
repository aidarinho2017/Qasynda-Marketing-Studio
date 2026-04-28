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

export interface Generation {
  id: string;
  type: 'marketplace' | 'ugc';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_data: Record<string, unknown>;
  source_image_url: string;
  image_urls: string[];
  prompt_used: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
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
