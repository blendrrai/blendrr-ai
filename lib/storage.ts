import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Zone } from './theme';
import type { Answers } from '../components/Questionnaire';
import {
  ensureUserProvisioned,
  getCachedUser,
  subscribeUser,
  updateCachedUser,
} from './user';

const HISTORY_KEY = 'blendrr.history.v1';
const WISHLIST_KEY = 'blendrr.wishlist.v1';
const ANALYSES_KEY = 'blendrr.analyses.v1';
const ROUTINE_ANSWERS_KEY = (cat: RoutineCategory) => `blendrr.routine.${cat}.answers.v1`;
const ROUTINE_PHOTO_KEY = (cat: RoutineCategory) => `blendrr.routine.${cat}.photo.v1`;
const ROUTINE_TIMESTAMP_KEY = (cat: RoutineCategory) => `blendrr.routine.${cat}.completedAt.v1`;
const CURRENCY_KEY = 'blendrr.currency.v1';

export type Category = 'skincare' | 'haircare' | 'fragrance' | 'makeup' | 'acne';
export type RoutineCategory = 'skincare' | 'haircare' | 'fragrance' | 'acne';
/** Categories that can appear in the analyses history. Includes one-shot tools like the ingredient scanner that don't have a saved routine. */
export type AnalysisCategory = RoutineCategory | 'ingredients';

export type TryOn = {
  id: string;
  createdAt: number;
  zone: Zone;
  selfieUri: string;
  /** Primary product (first in array). Kept for back-compat with old records. */
  productUri: string;
  /** All products that went into this try-on. Length 1 for single, up to 5 for multi. */
  productUris?: string[];
  productUrl: string | null;
  productUrls?: (string | null)[];
  /** User-editable product name (added/changed in the try-on detail screen). */
  productName?: string;
  /** Set when the try-on used multi mode. Missing on old records. */
  mode?: 'single' | 'multi';
  /** Quality tier used. Missing on old records. */
  quality?: 'medium' | 'ultra';
  resultUri: string | null;
};

export type WishlistItem = {
  id: string;
  createdAt: number;
  name: string;
  price: string;
  url: string;
  category: Category | null;
  notes: string | null;
};

export type Currency = 'GBP' | 'USD' | 'EUR';

export type Subscription = {
  tier: 'free' | 'pro';
  credits: number;
  currency: Currency;
};

const DEFAULT_SUBSCRIPTION: Subscription = { tier: 'free', credits: 2, currency: 'GBP' };

export type AppSettings = {
  notificationsEnabled: boolean;
};

const DEFAULT_SETTINGS: AppSettings = { notificationsEnabled: false };

const SETTINGS_KEY = 'blendrr.settings.v1';
const ONBOARDED_KEY = 'blendrr.onboarded.v1';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadHistory(): Promise<TryOn[]> {
  const list = await readJson<TryOn[]>(HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function saveTryOn(entry: TryOn): Promise<void> {
  const list = await loadHistory();
  const next = [entry, ...list].slice(0, 50);
  await writeJson(HISTORY_KEY, next);
}

export async function getTryOnById(id: string): Promise<TryOn | null> {
  const list = await loadHistory();
  return list.find((t) => t.id === id) ?? null;
}

/** Patch an existing try-on record (e.g. user edits product name / link). */
export async function updateTryOn(id: string, patch: Partial<TryOn>): Promise<TryOn[]> {
  const list = await loadHistory();
  const next = list.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await writeJson(HISTORY_KEY, next);
  return next;
}

export async function deleteTryOn(id: string): Promise<TryOn[]> {
  const list = await loadHistory();
  const next = list.filter((t) => t.id !== id);
  await writeJson(HISTORY_KEY, next);
  return next;
}

export async function loadWishlist(): Promise<WishlistItem[]> {
  const list = await readJson<WishlistItem[]>(WISHLIST_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function saveWishlistItem(item: WishlistItem): Promise<WishlistItem[]> {
  const list = await loadWishlist();
  const next = [item, ...list.filter((i) => i.id !== item.id)];
  await writeJson(WISHLIST_KEY, next);
  return next;
}

export async function deleteWishlistItem(id: string): Promise<WishlistItem[]> {
  const list = await loadWishlist();
  const next = list.filter((i) => i.id !== id);
  await writeJson(WISHLIST_KEY, next);
  return next;
}

export async function deleteWishlistItems(ids: string[]): Promise<WishlistItem[]> {
  if (ids.length === 0) return loadWishlist();
  const list = await loadWishlist();
  const idSet = new Set(ids);
  const next = list.filter((i) => !idSet.has(i.id));
  await writeJson(WISHLIST_KEY, next);
  return next;
}

export async function saveRoutineAnswers(cat: RoutineCategory, answers: Answers): Promise<void> {
  await writeJson(ROUTINE_ANSWERS_KEY(cat), answers);
  await writeJson(ROUTINE_TIMESTAMP_KEY(cat), Date.now());
}

export async function loadRoutineAnswers(cat: RoutineCategory): Promise<Answers | null> {
  return readJson<Answers | null>(ROUTINE_ANSWERS_KEY(cat), null);
}

export async function loadRoutineTimestamp(cat: RoutineCategory): Promise<number | null> {
  return readJson<number | null>(ROUTINE_TIMESTAMP_KEY(cat), null);
}

export async function saveRoutinePhoto(cat: RoutineCategory, uri: string | null): Promise<void> {
  if (uri === null) {
    await AsyncStorage.removeItem(ROUTINE_PHOTO_KEY(cat));
    return;
  }
  await AsyncStorage.setItem(ROUTINE_PHOTO_KEY(cat), uri);
}

export async function loadRoutinePhoto(cat: RoutineCategory): Promise<string | null> {
  return AsyncStorage.getItem(ROUTINE_PHOTO_KEY(cat));
}

export type AnalysisRecord = {
  id: string;
  createdAt: number;
  category: AnalysisCategory;
  summary: string;
  photoUri: string | null;
  data: unknown;
};

export async function loadAnalyses(): Promise<AnalysisRecord[]> {
  const list = await readJson<AnalysisRecord[]>(ANALYSES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function saveAnalysis(record: AnalysisRecord): Promise<AnalysisRecord[]> {
  const list = await loadAnalyses();
  const next = [record, ...list].slice(0, 50);
  await writeJson(ANALYSES_KEY, next);
  return next;
}

export async function deleteAnalysis(id: string): Promise<AnalysisRecord[]> {
  const list = await loadAnalyses();
  const next = list.filter((a) => a.id !== id);
  await writeJson(ANALYSES_KEY, next);
  return next;
}

// Currency is the only local part of subscription — tier + credits live on the server.
let cachedCurrency: Currency = DEFAULT_SUBSCRIPTION.currency;
let currencyLoaded = false;

async function ensureCurrencyLoaded(): Promise<Currency> {
  if (currencyLoaded) return cachedCurrency;
  const raw = await AsyncStorage.getItem(CURRENCY_KEY);
  if (raw === 'GBP' || raw === 'USD' || raw === 'EUR') {
    cachedCurrency = raw;
  }
  currencyLoaded = true;
  return cachedCurrency;
}

const subListeners = new Set<(sub: Subscription) => void>();

function buildSub(): Subscription {
  const user = getCachedUser();
  return {
    tier: user?.tier ?? DEFAULT_SUBSCRIPTION.tier,
    credits: user?.credits ?? DEFAULT_SUBSCRIPTION.credits,
    currency: cachedCurrency,
  };
}

function notifySubscription() {
  const sub = buildSub();
  subListeners.forEach((cb) => {
    try {
      cb(sub);
    } catch {
      // ignore listener errors
    }
  });
}

// Bridge user-change events into subscription-change events so existing callers
// don't need to know about the user module.
subscribeUser(() => notifySubscription());

export function subscribeSubscription(cb: (sub: Subscription) => void): () => void {
  subListeners.add(cb);
  return () => {
    subListeners.delete(cb);
  };
}

export async function loadSubscription(): Promise<Subscription> {
  // Ensure user is provisioned (cached after first call)
  let user = getCachedUser();
  if (!user) {
    try {
      user = await ensureUserProvisioned();
    } catch {
      // Network/offline — fall back to defaults; UI shows 0 credits until reconnect
    }
  }
  await ensureCurrencyLoaded();
  return buildSub();
}

/**
 * Persist the user's currency preference (the only locally-stored part of a Subscription).
 * Tier and credits are server-side; the simulate buttons in credits.tsx update the local
 * cache via updateCachedUser so the UI reflects them, but they won't persist server-side
 * until real IAP is wired.
 */
export async function saveSubscription(sub: Subscription): Promise<void> {
  if (sub.currency !== cachedCurrency) {
    cachedCurrency = sub.currency;
    currencyLoaded = true;
    await AsyncStorage.setItem(CURRENCY_KEY, sub.currency);
  }
  const cachedUser = getCachedUser();
  if (cachedUser && (cachedUser.tier !== sub.tier || cachedUser.credits !== sub.credits)) {
    updateCachedUser({ tier: sub.tier, credits: sub.credits });
  } else {
    notifySubscription();
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  const raw = await readJson<Partial<AppSettings>>(SETTINGS_KEY, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...raw } as AppSettings;
}

export async function saveAppSettings(s: AppSettings): Promise<void> {
  await writeJson(SETTINGS_KEY, s);
}

export async function clearAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const blendrrKeys = keys.filter((k) => k.startsWith('blendrr.'));
  await AsyncStorage.multiRemove(blendrrKeys);
}

export async function loadOnboardingSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ONBOARDED_KEY);
  return raw === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function canUseCredit(): Promise<CheckResult> {
  const sub = await loadSubscription();
  if (sub.credits <= 0) {
    return {
      ok: false,
      reason:
        sub.tier === 'pro'
          ? "You've used all your monthly credits. They reset next billing cycle."
          : 'No credits left. Upgrade to Pro or buy a credit pack.',
    };
  }
  return { ok: true };
}

/**
 * Credits are deducted server-side inside each Edge Function call. The client
 * never decrements directly — it reads the new count from the response. This
 * function is kept for legacy callers; it just returns the current state.
 */
export async function consumeCredit(): Promise<Subscription> {
  return loadSubscription();
}
