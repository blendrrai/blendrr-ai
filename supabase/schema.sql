-- Blendrr Ai — initial schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run)

-- ============================================================================
-- USERS (anonymous, no PII)
-- ============================================================================
create table if not exists public.users (
  id text primary key,                       -- anonymous UUID generated client-side, stored in iOS Keychain
  referral_code text unique not null,        -- 6-char short code, e.g. "LUNA42"
  tier text not null default 'free',         -- 'free' | 'pro'
  credits integer not null default 5,        -- 5 free lifetime AI uses (try-ons, quizzes, scans). After that → paywall.
  created_at timestamptz not null default now(),
  pro_started_at timestamptz,                -- when they last became Pro
  pro_credits_renew_at timestamptz,          -- when the 30-credit monthly bucket next refills
  has_redeemed_referral boolean not null default false
);

alter table public.users enable row level security;

-- Anyone authenticated as that user can read their own row (Edge Functions use service_role and bypass this)
create policy "Users can read own row"
  on public.users for select
  using (id = current_setting('request.headers', true)::json->>'x-blendrr-user');

-- Updates are only via Edge Functions (service_role). No client-side write policy.

-- ============================================================================
-- REFERRALS
-- ============================================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id text not null references public.users(id) on delete cascade,
  invitee_id text not null references public.users(id) on delete cascade,
  status text not null default 'pending',     -- 'pending' | 'rewarded'
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  unique (invitee_id)                          -- each invitee can only redeem one code, ever
);

alter table public.referrals enable row level security;

-- No client policy; Edge Functions only.

create index if not exists referrals_inviter_idx on public.referrals(inviter_id);

-- ============================================================================
-- TRY-ON HISTORY (optional cloud backup, separate from local history)
-- Lets users access their history if they reinstall and recover via referral code or similar later
-- ============================================================================
create table if not exists public.tryons (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  zone text not null,                         -- 'lips' | 'face' | 'hair'
  product_url text,
  result_storage_path text,                   -- path in Supabase Storage to the generated image (optional)
  created_at timestamptz not null default now()
);

alter table public.tryons enable row level security;

create index if not exists tryons_user_idx on public.tryons(user_id, created_at desc);

-- ============================================================================
-- TRY-ON JOBS (async processing queue)
-- The Edge Function creates a row when a try-on is requested, returns the
-- jobId immediately, and continues the actual AI work via EdgeRuntime.waitUntil.
-- The client polls this row for completion. Lets users background the app
-- (lock phone, switch apps) without the request dying.
-- ============================================================================
create table if not exists public.tryon_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  status text not null default 'pending',        -- 'pending' | 'processing' | 'complete' | 'failed'
  task text not null,                             -- 'try-on' (extensible to other long tasks later)
  result_image_base64 text,                       -- only populated when status = 'complete'
  partial_image_base64 text,                      -- latest streamed preview frame while status = 'processing'; cleared on complete
  shade jsonb,                                    -- extracted shade info for single-product mode
  credits_charged integer not null,               -- credits deducted up front; refunded if status ends as 'failed'
  error text,                                     -- populated when status = 'failed'
  created_at timestamptz not null default now(),
  started_at timestamptz,                         -- when the worker picked it up
  completed_at timestamptz                        -- when it reached a terminal status
);

-- Migration for existing installs (idempotent — safe to run on a DB that
-- already has the column).
alter table public.tryon_jobs add column if not exists partial_image_base64 text;

alter table public.tryon_jobs enable row level security;

-- No client-side policy. All access goes through Edge Functions using service_role
-- (which bypasses RLS) — the get-job-status task handles the user-scoping check.

create index if not exists tryon_jobs_user_status_idx
  on public.tryon_jobs(user_id, status, created_at desc);

-- Stale-job cleanup. Run this periodically (e.g. via pg_cron) to prune completed
-- jobs older than 24h. Result images can be large (base64 PNG), keeping them
-- around forever bloats the DB.
-- create extension if not exists pg_cron;
-- select cron.schedule('cleanup-tryon-jobs', '0 3 * * *',
--   $$ delete from public.tryon_jobs where status in ('complete', 'failed') and completed_at < now() - interval '24 hours' $$
-- );

-- ============================================================================
-- HELPERS
-- ============================================================================

-- Generate a unique 6-char referral code (uppercase alphanumeric, no confusing chars)
create or replace function public.gen_referral_code()
returns text language plpgsql as $$
declare
  candidate text;
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- excludes I, L, 0, 1, O
  i int;
  attempt int := 0;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    if not exists (select 1 from public.users where referral_code = candidate) then
      return candidate;
    end if;
    attempt := attempt + 1;
    if attempt > 50 then
      raise exception 'Could not generate unique referral code after 50 attempts';
    end if;
  end loop;
end $$;
