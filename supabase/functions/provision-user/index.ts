// Supabase Edge Function: provision-user
// Called by the client on first launch (or if user row missing) to provision an
// anonymous user record. Returns existing row if userId already exists.
// Deploy: `supabase functions deploy provision-user`

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
    const { userId } = await req.json();
    if (!userId || typeof userId !== 'string') {
      return json({ error: 'Missing userId' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try to find existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id, referral_code, tier, credits, has_redeemed_referral')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      return json({ user: existing });
    }

    // Generate a unique referral code via SQL helper
    const { data: codeRow, error: codeError } = await supabase.rpc('gen_referral_code');
    if (codeError) return json({ error: codeError.message }, 500);
    const referralCode = codeRow as string;

    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        referral_code: referralCode,
        tier: 'free',
        credits: 5,
        has_redeemed_referral: false,
      })
      .select('id, referral_code, tier, credits, has_redeemed_referral')
      .single();

    if (insertError) return json({ error: insertError.message }, 500);
    return json({ user: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
