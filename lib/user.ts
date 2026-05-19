import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_ID_KEY = 'blendrr.userId.v1';

export type User = {
  id: string;
  referral_code: string;
  tier: 'free' | 'pro';
  credits: number;
  has_redeemed_referral: boolean;
};

let cachedUser: User | null = null;
const listeners = new Set<(u: User | null) => void>();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb(cachedUser);
    } catch {
      // ignore listener errors
    }
  });
}

export function getCachedUser(): User | null {
  return cachedUser;
}

export function subscribeUser(cb: (u: User | null) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** RFC4122 v4 UUID. Math.random is fine here — this is an anonymous device ID, not a security token. */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the device's anonymous user ID. Generated once and persisted in iOS
 * Keychain, which survives app deletes (as long as iCloud Keychain is on — default).
 */
export async function ensureUserId(): Promise<string> {
  let id = await SecureStore.getItemAsync(USER_ID_KEY);
  if (!id) {
    id = generateUUID();
    await SecureStore.setItemAsync(USER_ID_KEY, id);
  }
  return id;
}

/**
 * Ensures a row in `public.users` exists for this device. Returns the row.
 * Safe to call multiple times — Edge Function dedupes.
 */
async function readEdgeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const text = await ctx.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) return String(parsed.error);
        if (parsed?.message) return String(parsed.message);
      } catch {
        if (text) return text.slice(0, 300);
      }
    } catch {
      // ignore
    }
  }
  return (error as { message?: string }).message ?? 'Unknown error';
}

export async function ensureUserProvisioned(): Promise<User> {
  const id = await ensureUserId();

  const { data, error } = await supabase.functions.invoke('provision-user', {
    body: { userId: id },
  });

  if (error) {
    const detailed = await readEdgeError(error);
    console.warn('[blendrr] provision-user error:', detailed);
    throw new Error(`Could not provision user: ${detailed}`);
  }
  if (!data?.user) {
    throw new Error(data?.error ?? 'Provisioning returned no user');
  }

  cachedUser = data.user as User;
  notify();
  return cachedUser;
}

/** Merge a partial update into the cached user and notify subscribers. */
export function updateCachedUser(partial: Partial<User>): void {
  if (!cachedUser) return;
  cachedUser = { ...cachedUser, ...partial };
  notify();
}

/** Force a re-fetch from the server (e.g., after Pro purchase or referral redeem). */
export async function refreshUser(): Promise<User | null> {
  if (!cachedUser) return ensureUserProvisioned();
  return ensureUserProvisioned();
}

export async function redeemReferralCode(
  code: string,
): Promise<{ ok: true; reward: number; credits: number } | { ok: false; error: string }> {
  const id = await ensureUserId();
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'Enter a code.' };

  const { data, error } = await supabase.functions.invoke('redeem-referral', {
    body: { userId: id, code: trimmed },
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };

  if (cachedUser && typeof data?.new_credits === 'number') {
    cachedUser = {
      ...cachedUser,
      credits: data.new_credits,
      has_redeemed_referral: true,
    };
    notify();
  }

  return { ok: true, reward: data.invitee_reward ?? 5, credits: data.new_credits ?? cachedUser?.credits ?? 0 };
}
