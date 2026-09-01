-- Phase 1: authentication & accounts
--
-- Creates the `public.users` profile table (one row per `auth.users` row,
-- auto-populated on Google sign-in), a public-safe view for profile pages,
-- and the RLS/trigger plumbing to keep privileged columns
-- (is_admin, currency_balance, den_size, google_sub, email) out of reach of
-- normal client updates.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  google_sub text,
  email text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  currency_balance integer not null default 0,
  den_size integer not null default 3,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.users is 'Player profile + economy state, one row per auth.users row.';
comment on column public.users.den_size is 'Max pets the user may own. Starts at 3 (starter pet + tutorial reward + headroom).';

alter table public.users enable row level security;

-- Every signed-in user can see their own full row (settings page, currency
-- balance, den size, etc). Public-facing profile data is served through the
-- `user_profiles` view below instead of relaxing this policy.
create policy "Users can view own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policies: rows are created by the handle_new_user
-- trigger (security definer, bypasses RLS) and never deleted directly by
-- users; account deletion should be handled via a dedicated admin/service
-- flow once that exists.

-- Belt-and-suspenders beyond RLS: even though the app's own update code
-- only ever sends display_name/avatar_url/bio, enforce server-side that a
-- non-service-role UPDATE can never change privileged columns, so a bug or
-- a future client-side form can't accidentally (or maliciously) grant
-- currency, admin, or den capacity.
create function public.protect_privileged_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.currency_balance := old.currency_balance;
    new.den_size := old.den_size;
    new.google_sub := old.google_sub;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger protect_privileged_user_fields
  before update on public.users
  for each row execute function public.protect_privileged_user_fields();

-- Auto-create a profile row when a user first signs in with Google.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, google_sub, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'),
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Public-safe view for profile pages (`/u/[id]`) and anything else that
-- needs to display another user's basic info. Deliberately excludes email,
-- google_sub, currency_balance, den_size, and is_admin. Owned by the
-- migration role (not security_invoker), so it intentionally reads through
-- RLS on the base table to expose just these columns to everyone.
create view public.user_profiles as
  select id, display_name, avatar_url, bio, created_at
  from public.users;

grant select on public.user_profiles to anon, authenticated;
