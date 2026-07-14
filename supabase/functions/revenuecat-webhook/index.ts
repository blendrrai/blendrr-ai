// Supabase Edge Function: revenuecat-webhook
//
// Receives subscription events from RevenueCat and mirrors them into our
// public.users table. The client SDK gives users a snappy Pro experience
// the moment they buy (optimistic update), but this webhook is what
// PERSISTS Pro state so it survives across devices and app reinstalls.
//
// Auth: RevenueCat sends an `Authorization` header with the value we set
// as the webhook Authorization header in RC dashboard. We compare it
// against REVENUECAT_WEBHOOK_SECRET from Supabase secrets. Reject anything
// that doesn't match — random POSTs to this URL could otherwise flip
// anyone to Pro.
//
// Deploy: `supabase functions deploy revenuecat-webhook --no-verify-jwt`
//   The --no-verify-jwt is critical: RevenueCat doesn't have Supabase JWTs,
//   so we use the RC auth header instead.
//
// Register: in RC dashboard → Project Settings → Integrations → Webhooks
//   URL:  https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   Auth: pick a strong random string; store it here as
//         REVENUECAT_WEBHOOK_SECRET (supabase secrets set REVENUECAT_WEBHOOK_SECRET=...)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

const PRO_ENTITLEMENT_ID = 'pro';
const PRO_CREDITS_PER_MONTH = 30;

// RC event types worth acting on. See:
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
type RcEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'   // user turned off auto-renew — still Pro until period end
  | 'UNCANCELLATION' // user re-enabled auto-renew
  | 'EXPIRATION'     // subscription actually ended
  | 'BILLING_ISSUE'  // grace period
  | 'SUBSCRIBER_ALIAS' // ignore (identity aliasing)
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'REFUND'
  | 'TRANSFER'
  | 'TEST'; // fires when you hit "Send Test" in RC dashboard

type RcEvent = {
  type: RcEventType;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  product_id?: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
  event_timestamp_ms?: number;
  expiration_at_ms?: number | null;
};

type RcWebhookBody = { event: RcEvent; api_version?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ─── Auth ────────────────────────────────────────────────────────────
  // Reject anything without the shared secret. Prevents random internet
  // POSTs from flipping arbitrary users to Pro.
  const authHeader = req.headers.get('authorization') ?? '';
  if (!REVENUECAT_WEBHOOK_SECRET || authHeader !== REVENUECAT_WEBHOOK_SECRET) {
    console.log(`[rc-webhook] rejected — bad auth (got ${authHeader.slice(0, 12)}…)`);
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: RcWebhookBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const event = body?.event;
  if (!event?.type) return json({ error: 'Missing event.type' }, 400);

  const userId = event.app_user_id ?? event.original_app_user_id;
  if (!userId) return json({ error: 'Missing app_user_id' }, 400);

  console.log(
    `[rc-webhook] event=${event.type} user=${userId.slice(0, 8)}… ` +
    `env=${event.environment ?? '?'} product=${event.product_id ?? '?'} ` +
    `expires=${event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : 'n/a'}`,
  );

  // TEST events fire from the RC dashboard "Send Test" button. Acknowledge
  // and return so we don't try to mutate a probably-non-existent user row.
  if (event.type === 'TEST') return json({ ok: true, test: true });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify the user row exists. If not, create a minimal one so the tier
  // flip lands somewhere — better than 404ing and having Pro never sync.
  const { data: existing } = await supabase
    .from('users')
    .select('id, tier, credits')
    .eq('id', userId)
    .maybeSingle();

  if (!existing) {
    console.log(`[rc-webhook] user ${userId.slice(0, 8)}… not found — inserting stub row`);
    const { error: insertErr } = await supabase.from('users').insert({
      id: userId,
      referral_code: userId.slice(0, 6).toUpperCase(),
      tier: 'free',
      credits: 5,
    });
    if (insertErr) {
      console.log(`[rc-webhook] stub insert failed: ${insertErr.message}`);
      return json({ error: `Could not create user row: ${insertErr.message}` }, 500);
    }
  }

  // Decide the tier + credit outcome based on event type.
  const grantsPro =
    (event.entitlement_ids ?? []).includes(PRO_ENTITLEMENT_ID) ||
    // Some events (RENEWAL) come with the same entitlement structure but
    // occasionally RC omits entitlement_ids — infer from type.
    event.type === 'INITIAL_PURCHASE' ||
    event.type === 'RENEWAL' ||
    event.type === 'PRODUCT_CHANGE' ||
    event.type === 'UNCANCELLATION';

  const revokesPro =
    event.type === 'EXPIRATION' ||
    event.type === 'REFUND';
    // CANCELLATION does NOT revoke — user keeps Pro until EXPIRATION fires.

  const nowIso = new Date().toISOString();

  if (grantsPro) {
    // Grant Pro + refill credits to the monthly allowance. If the user is
    // already Pro (renewal), just refill credits.
    const { error } = await supabase
      .from('users')
      .update({
        tier: 'pro',
        credits: PRO_CREDITS_PER_MONTH,
        pro_started_at:
          existing?.tier === 'pro' ? undefined : nowIso, // don't overwrite on renewal
        pro_credits_renew_at: event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : nowIso,
      })
      .eq('id', userId);
    if (error) {
      console.log(`[rc-webhook] pro-grant update failed: ${error.message}`);
      return json({ error: error.message }, 500);
    }
    console.log(`[rc-webhook] granted pro to ${userId.slice(0, 8)}… (credits=${PRO_CREDITS_PER_MONTH})`);
    return json({ ok: true, action: 'granted_pro' });
  }

  if (revokesPro) {
    const { error } = await supabase
      .from('users')
      .update({
        tier: 'free',
        // Do NOT reset credits here — user might still have unused credits
        // they should keep after downgrading.
        pro_credits_renew_at: null,
      })
      .eq('id', userId);
    if (error) {
      console.log(`[rc-webhook] pro-revoke update failed: ${error.message}`);
      return json({ error: error.message }, 500);
    }
    console.log(`[rc-webhook] revoked pro from ${userId.slice(0, 8)}…`);
    return json({ ok: true, action: 'revoked_pro' });
  }

  // Anything else (CANCELLATION, BILLING_ISSUE, SUBSCRIBER_ALIAS, etc.) —
  // acknowledge but don't mutate. User stays on their current tier until an
  // actual EXPIRATION or new purchase.
  console.log(`[rc-webhook] no-op event ${event.type}`);
  return json({ ok: true, action: 'noop' });
});
