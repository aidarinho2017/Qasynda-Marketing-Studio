'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import type { TopupPack, TopupResponse, User } from './types';

// Pricing — must match backend app/core/pricing.py
export const CREDITS_PER_IMAGE = 5;
export const CREDITS_BY_COUNT: Record<number, number> = {
  1: 5,
  2: 9,
  3: 14,
  4: 17,
};
export const LISTING_PACK_CREDITS = 25;
export const GROWTH_TURN_CREDITS = 0.5;

export const TOPUP_PACKS: TopupPack[] = [
  { id: 'basic', credits: 50, price_usd: 3, name: 'Basic' },
  { id: 'pro', credits: 100, price_usd: 5, name: 'Pro' },
  { id: 'ultra', credits: 500, price_usd: 22, name: 'Ultra' },
];

export function fullPriceForCount(count: number): number {
  return count * CREDITS_PER_IMAGE;
}

export function bundlePriceForCount(count: number): number {
  return CREDITS_BY_COUNT[count] ?? count * CREDITS_PER_IMAGE;
}

// ─── Tiny pub-sub credits store ──────────────────────────────────────────────

type Listener = (balance: number | null) => void;

const listeners = new Set<Listener>();
let balance: number | null = null;

function notify() {
  for (const l of listeners) l(balance);
}

function setBalance(next: number | null) {
  balance = next;
  notify();
}

export function setCreditsBalance(value: number): void {
  setBalance(value);
}

export async function refreshCredits(): Promise<number | null> {
  try {
    const me = await api.get<User>('/me');
    setBalance(me.credits_balance);
    return me.credits_balance;
  } catch {
    return balance;
  }
}

export async function topupCredits(packId: string): Promise<TopupResponse> {
  const res = await api.post<TopupResponse>('/me/topup', { pack_id: packId });
  setBalance(res.credits_balance);
  return res;
}

// ─── Insufficient-credits global event ───────────────────────────────────────

const INSUFFICIENT_EVENT = 'qasynda:insufficient-credits';

export function triggerInsufficientCredits(message?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INSUFFICIENT_EVENT, { detail: message }));
}

export function onInsufficientCredits(
  handler: (message?: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const msg = (e as CustomEvent<string | undefined>).detail;
    handler(msg);
  };
  window.addEventListener(INSUFFICIENT_EVENT, listener);
  return () => window.removeEventListener(INSUFFICIENT_EVENT, listener);
}

export function useCredits(): {
  balance: number | null;
  refresh: () => Promise<number | null>;
  topup: (packId: string) => Promise<TopupResponse>;
} {
  const [value, setValue] = useState<number | null>(balance);

  useEffect(() => {
    listeners.add(setValue);
    if (balance === null) {
      void refreshCredits();
    }
    return () => {
      listeners.delete(setValue);
    };
  }, []);

  return { balance: value, refresh: refreshCredits, topup: topupCredits };
}
