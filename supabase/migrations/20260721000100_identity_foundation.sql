create extension if not exists pgcrypto with schema extensions;

create type public.company_slug as enum ('atlas', 'big_link');
create type public.profile_status as enum ('pending', 'active', 'suspended');
create type public.membership_role as enum ('administrator');
create type public.membership_status as enum ('invited', 'active', 'suspended');

create table public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  slug public.company_slug not null unique,
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  display_name text not null check (char_length(display_name) between 2 and 100),
  registration_number text,
  vat_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (email = lower(email)),
  status public.profile_status not null default 'pending',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email));

create table public.company_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  role public.membership_role not null default 'administrator',
  status public.membership_status not null default 'invited',
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_memberships_company_idx on public.company_memberships (company_id, status);

create table public.invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null check (email = lower(email)),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index invitations_active_email_unique
  on public.invitations (company_id, lower(email))
  where accepted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger company_memberships_set_updated_at
before update on public.company_memberships
for each row execute function public.set_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.company_id
  from public.company_memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.is_active_administrator()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.company_memberships m
    join public.profiles p on p.id = m.profile_id
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
      and m.status = 'active'
      and m.role = 'administrator'
  );
$$;

create or replace function public.has_required_mfa()
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_company_id() from public;
revoke all on function public.is_active_administrator() from public;
revoke all on function public.has_required_mfa() from public;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_active_administrator() to authenticated;
grant execute on function public.has_required_mfa() to authenticated;
