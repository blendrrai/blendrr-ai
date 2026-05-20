// Supabase Edge Function: redeem-referral
// Called when a new user enters a referral code. Validates, creates referral row,
// credits both the inviter (3 credits) and the invitee (5 credits).
// Deploy: `supabase functions deploy redeem-referral`

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// 1 credit each side. Was 5/3 — too pricey when each try-on can cost up to
// 3 credits worth of API calls and referrals can chain.
const INVITEE_REWARD = 1;
const INVITER_REWARD = 1;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, code } = await req.json();
    if (!userId || !code) return json({ error: 'Missing userId or code' }, 400);

    const normalized = String(code).trim().toUpperCase();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find invitee (current user)
    const { data: invitee, error: inviteeErr } = await supabase
      .from('users')
      .select('id, referral_code, has_redeemed_referral, credits')
      .eq('id', userId)
      .single();
    if (inviteeErr || !invitee) return json({ error: 'User not found' }, 401);

    if (invitee.has_redeemed_referral) {
      return json({ error: 'You have already used a referral code.' }, 400);
    }
    if (invitee.referral_code === normalized) {
      return json({ error: "You can't use your own referral code." }, 400);
    }

    // Find inviter by referral_code
    const { data: inviter, error: inviterErr } = await supabase
      .from('users')
      .select('id, credits')
      .eq('referral_code', normalized)
      .maybeSingle();
    if (inviterErr || !inviter) {
      return json({ error: "That code isn't valid." }, 404);
    }

    // Create referral row
    const { error: refErr } = await supabase.from('referrals').insert({
      inviter_id: inviter.id,
      invitee_id: invitee.id,
      status: 'rewarded',
      rewarded_at: new Date().toISOString(),
    });
    if (refErr) {
      // Likely unique constraint violation (this invitee already redeemed) — should be caught above but defensive
      return json({ error: 'Could not redeem this code.' }, 400);
    }

    // Credit both users
    await supabase
      .from('users')
      .update({ credits: invitee.credits + INVITEE_REWARD, has_redeemed_referral: true })
      .eq('id', invitee.id);

    await supabase
      .from('users')
      .update({ credits: inviter.credits + INVITER_REWARD })
      .eq('id', inviter.id);

    return json({
      success: true,
      invitee_reward: INVITEE_REWARD,
      inviter_reward: INVITER_REWARD,
      new_credits: invitee.credits + INVITEE_REWARD,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
