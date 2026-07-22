-- Email second factor.
--
-- The portal originally gated every read on Supabase AAL2, which can only be reached
-- by enrolling a TOTP authenticator app. Ofentse asked for the second factor to be a
-- short numeric code delivered by email instead, so has_required_mfa() is redefined
-- to check a verified challenge bound to the caller's current auth session.
--
-- Every RLS policy already calls has_required_mfa(), so redefining that one function
-- switches the whole portal over without touching a single policy.

create table public.email_mfa_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index email_mfa_challenges_lookup_idx
  on public.email_mfa_challenges (profile_id, session_id, created_at desc);

-- Only one live challenge per session at a time; issuing a new code retires the old.
create unique index email_mfa_challenges_active_idx
  on public.email_mfa_challenges (profile_id, session_id)
  where consumed_at is null and verified_at is null;

alter table public.email_mfa_challenges enable row level security;
-- Deliberately no policies: this table is written and read only by the service role
-- from trusted server routes, and by the security definer function below. Any policy
-- here that called has_required_mfa() would recurse.

revoke all on table public.email_mfa_challenges from anon, authenticated;

-- How long a verified session stays trusted before the code is demanded again.
create or replace function public.email_mfa_session_ttl()
returns interval
language sql
immutable
as $$
  select interval '12 hours';
$$;

create or replace function public.has_required_mfa()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.email_mfa_challenges c
    join public.profiles p on p.id = c.profile_id
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
      and c.session_id = coalesce(auth.jwt() ->> 'session_id', '')
      and c.verified_at is not null
      and c.verified_at > now() - public.email_mfa_session_ttl()
  );
$$;

revoke all on function public.has_required_mfa() from public;
grant execute on function public.has_required_mfa() to authenticated;

comment on function public.has_required_mfa() is
  'True when the caller''s current auth session has passed the emailed numeric second factor within the session TTL. Replaces the original Supabase AAL2 check.';
