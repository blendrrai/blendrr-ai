// RevenueCat wrapper. All purchase/restore/entitlement logic goes through
// this module — nothing else imports 'react-native-purchases' directly.
//
// Key design choices:
//   1. Defensive dynamic require. The native module isn't present in Expo
//      Go, so we swallow the require error and mark the module unavailable.
//      Every exported function checks this flag and either no-ops or
//      throws a friendly "not available" error. Real dev-client / TestFlight
//      builds run the actual RC SDK.
//   2. `appUserID` is our anonymous UUID from ensureUserId. Ties each RC
//      customer 1:1 to a BLENDRR install so purchases follow the same
//      person across reinstalls (UUID is Keychain-persisted).
//   3. The 'pro' entitlement id is case-sensitive and matches the RC
//      dashboard exactly. Don't change without also updating the dashboard.

import { Platform } from 'react-native';

// Public API key — safe to embed in the client binary. Every user who
// downloads the app has access to it once they decompile the IPA anyway.
// The keys we protect are the RC "secret" keys used server-side.
const IOS_API_KEY = 'appl_ipSAGwSOVsRYutqvzTyYiYbpcOf';
const PRO_ENTITLEMENT_ID = 'pro';

type CustomerInfo = {
  entitlements: {
    active: Record<string, unknown>;
  };
  activeSubscriptions: string[];
  latestExpirationDate?: string | null;
  originalAppUserId?: string;
};

type PurchasesPackage = unknown;

type PurchasesModule = {
  configure: (opts: { apiKey: string; appUserID: string }) => void;
  logIn: (userId: string) => Promise<unknown>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<{
    current: {
      monthly?: PurchasesPackage;
      availablePackages: PurchasesPackage[];
    } | null;
  }>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ customerInfo: CustomerInfo; userCancelled?: boolean }>;
  restorePurchases: () => Promise<CustomerInfo>;
  addCustomerInfoUpdateListener: (cb: (info: CustomerInfo) => void) => void;
};

let Purchases: PurchasesModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

let initialized = false;
const listeners = new Set<(info: CustomerInfo) => void>();

export function isPurchasesAvailable(): boolean {
  return Purchases !== null && Platform.OS === 'ios';
}

/**
 * Initialise RevenueCat with the given anonymous user id. Safe to call
 * multiple times — on subsequent calls it just re-associates the user id
 * (useful if the user clears local data and gets a fresh UUID).
 *
 * Call once from the root layout after ensureUserProvisioned resolves.
 */
export async function initPurchases(userId: string): Promise<void> {
  if (!isPurchasesAvailable() || !Purchases) return;
  if (initialized) {
    try { await Purchases.logIn(userId); } catch { /* ignore */ }
    return;
  }
  try {
    Purchases.configure({ apiKey: IOS_API_KEY, appUserID: userId });
    Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
      listeners.forEach((cb) => {
        try { cb(info); } catch { /* ignore listener errors */ }
      });
    });
    initialized = true;
  } catch (e) {
    console.warn('[purchases] init failed:', e);
  }
}

export function isProFromCustomerInfo(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  return !!info.entitlements?.active?.[PRO_ENTITLEMENT_ID];
}

/**
 * Fetch the current "default" offering's monthly package. Returns null if
 * RC isn't configured or the offering isn't set up correctly in the dashboard.
 */
export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  if (!isPurchasesAvailable() || !initialized || !Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return current.monthly ?? current.availablePackages[0] ?? null;
  } catch (e) {
    console.warn('[purchases] getOfferings failed:', e);
    return null;
  }
}

/**
 * Present Apple's StoreKit sheet for the monthly Pro subscription.
 * Returns the updated CustomerInfo on success.
 * Throws with a user-friendly message on cancel or error.
 */
export async function purchaseMonthly(): Promise<CustomerInfo> {
  if (!isPurchasesAvailable() || !Purchases) {
    throw new Error('In-app purchases are unavailable in Expo Go. Build a dev client to test.');
  }
  if (!initialized) {
    throw new Error('Purchases not initialised yet — try again in a moment.');
  }
  const pkg = await getMonthlyPackage();
  if (!pkg) {
    throw new Error('No subscription available. Check your connection and try again.');
  }
  const result = await Purchases.purchasePackage(pkg);
  if (result.userCancelled) {
    throw new Error('Purchase cancelled.');
  }
  return result.customerInfo;
}

/**
 * Restore purchases across devices (Apple ID -tied). Returns CustomerInfo
 * with whatever entitlements were restored. Users hit this via the
 * "Restore Purchases" button in Settings / Credits.
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  if (!isPurchasesAvailable() || !Purchases) {
    throw new Error('Restore is unavailable in Expo Go. Build a dev client to test.');
  }
  if (!initialized) {
    throw new Error('Purchases not initialised yet — try again in a moment.');
  }
  return await Purchases.restorePurchases();
}

/** Read current CustomerInfo (RC caches this locally). */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesAvailable() || !initialized || !Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/**
 * Subscribe to CustomerInfo changes (fires on every RC event — purchases,
 * renewals, cancellations pushed from RC). Returns unsubscribe function.
 */
export function subscribeCustomerInfo(cb: (info: CustomerInfo) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
