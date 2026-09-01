-- Phase 2 (partial) + Phase 3: pet/zone/expedition schema, plus the
-- starter pet + one-time tutorial expedition flow.
--
-- Scope note: this only creates what's needed to grant a starter pet and
-- run the fixed-length, fixed-pool tutorial expedition end to end. Items,
-- potions, loot tables, and the full zone-selection expedition system are
-- separate future modules/migrations, per the project's one-module-at-a-
-- time build order. `expeditions` is written to be extended later (e.g.
-- adding potion_id_used, result_item_id) via ALTER TABLE once those
-- modules exist, rather than guessed at now.
--
-- The free starter pet and the tutorial expedition's reward both draw from
-- "the same standard starter pool" per spec, so rather than a separate
-- is_starter flag on species, they share one zone (flagged is_tutorial)
-- and its zone_pet_pool as that pool's single source of truth.

create type public.pet_rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');
create type public.expedition_status as enum ('in_progress', 'completed');

-- ── Species ──────────────────────────────────────────────────────────────
create table public.species (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rarity public.pet_rarity not null default 'common',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.species.image_url is
  'Single composited base image (placeholder art for now). Layered base/accessory art is a later module.';

alter table public.species enable row level security;

create policy "Species are viewable by everyone"
  on public.species for select
  using (true);

-- No insert/update/delete policy yet: species are only managed by the
-- (not yet built) admin panel via the service role, which bypasses RLS.

-- ── Pets ─────────────────────────────────────────────────────────────────
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  species_id uuid not null references public.species (id),
  color_variant text,
  rarity public.pet_rarity not null,
  created_at timestamptz not null default now()
);

create index pets_owner_id_idx on public.pets (owner_id);

alter table public.pets enable row level security;

create policy "Users can view own pets"
  on public.pets for select
  using (auth.uid() = owner_id);

-- No insert/update/delete policies: pets are only ever created by the
-- security-definer functions below (starter grant, expedition
-- resolution), which enforce den-size caps and pool logic server-side. A
-- future trading module will add its own atomic, RPC-driven transfer
-- logic rather than a client-writable policy.

-- ── Zones ────────────────────────────────────────────────────────────────
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier integer not null default 1,
  description text,
  image_url text,
  unlock_requirement text,
  is_tutorial boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.zones.is_tutorial is
  'The fixed-length, fixed-pool starter/tutorial zone. Excluded from normal zone selection once that system exists.';

alter table public.zones enable row level security;

create policy "Active zones are viewable by everyone"
  on public.zones for select
  using (is_active);

-- ── Zone pet pool ────────────────────────────────────────────────────────
create table public.zone_pet_pool (
  zone_id uuid not null references public.zones (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete cascade,
  drop_weight integer not null default 1 check (drop_weight > 0),
  primary key (zone_id, species_id)
);

alter table public.zone_pet_pool enable row level security;

create policy "Zone pet pools are viewable by everyone"
  on public.zone_pet_pool for select
  using (true);

-- ── Expeditions ──────────────────────────────────────────────────────────
create table public.expeditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  zone_id uuid not null references public.zones (id),
  status public.expedition_status not null default 'in_progress',
  is_tutorial boolean not null default false,
  started_at timestamptz not null default now(),
  resolves_at timestamptz not null,
  result_pet_id uuid references public.pets (id),
  created_at timestamptz not null default now()
);

create index expeditions_user_status_resolves_idx
  on public.expeditions (user_id, status, resolves_at);

alter table public.expeditions enable row level security;

create policy "Users can view own expeditions"
  on public.expeditions for select
  using (auth.uid() = user_id);

-- No insert/update policies: expeditions are only created/resolved through
-- the security-definer functions below.

-- ── users: starter-grant guard ──────────────────────────────────────────
alter table public.users add column starter_granted boolean not null default false;

-- 0001's protect_privileged_user_fields() trigger function predates this
-- column, so it doesn't yet block a non-service-role update from resetting
-- it — which would let a user re-run grant_starter_pet_and_tutorial and
-- mint themselves unlimited free starter pets.
--
-- Simply checking auth.role() = 'service_role' isn't enough to also let
-- OUR OWN security-definer functions (below) write starter_granted: RPC
-- calls made by a signed-in player carry auth.role() = 'authenticated' in
-- their JWT regardless of the function being SECURITY DEFINER — that
-- setting reflects who's calling, not whose privileges the function body
-- runs with. So a blanket "block all non-service-role writes" would also
-- block the legitimate write this feature depends on.
--
-- Instead: a transaction-local flag that only a security-definer function
-- can set (never a client — see begin_trusted_user_write below) marks the
-- rest of that transaction as a trusted write. It resets automatically at
-- transaction end either way, so nothing needs to "turn it back off."
create function public.begin_trusted_user_write()
returns void
language sql
as $$
  select set_config('app.trusted_user_write', 'true', true);
$$;

revoke all on function public.begin_trusted_user_write() from public;

-- Redefine (not re-create: the trigger from 0001 already points at this
-- function by name) to also guard starter_granted, and to respect the
-- trusted-write escape hatch. Any future privileged column must be added
-- to this same list.
create or replace function public.protect_privileged_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and coalesce(current_setting('app.trusted_user_write', true), 'false') <> 'true' then
    new.is_admin := old.is_admin;
    new.currency_balance := old.currency_balance;
    new.den_size := old.den_size;
    new.google_sub := old.google_sub;
    new.email := old.email;
    new.starter_granted := old.starter_granted;
  end if;
  return new;
end;
$$;

-- ── Shared weighted-random pool roll ────────────────────────────────────
-- Efraimidis-Spirakis weighted sampling: picking the row that maximizes
-- random()^(1/weight) is a standard, correct way to do a single weighted
-- random draw without replacement. Expeditions (this module), and later
-- potion effects and statue offerings, all reuse this same roll against a
-- pool table, per spec.
create function public.pick_weighted_zone_species(p_zone_id uuid)
returns uuid
language sql
as $$
  select species_id
  from public.zone_pet_pool
  where zone_id = p_zone_id
  order by power(random(), 1.0 / drop_weight) desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_species(uuid) from public;

-- ── Starter pet + tutorial expedition ───────────────────────────────────
create function public.grant_starter_pet_and_tutorial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutorial_zone_id uuid;
  v_species_id uuid;
  v_species_rarity public.pet_rarity;
  v_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  -- Idempotency + race-safety: only the caller that flips this flag from
  -- false to true proceeds past this point. A duplicate/concurrent call
  -- is a no-op.
  perform public.begin_trusted_user_write();
  update public.users
  set starter_granted = true
  where id = p_user_id and starter_granted = false;

  if not found then
    return;
  end if;

  select id into v_tutorial_zone_id
  from public.zones
  where is_tutorial and is_active
  limit 1;

  if v_tutorial_zone_id is null then
    raise exception 'No active tutorial/starter zone configured.';
  end if;

  v_species_id := public.pick_weighted_zone_species(v_tutorial_zone_id);

  if v_species_id is null then
    raise exception 'Tutorial/starter zone has no species in its pet pool.';
  end if;

  select rarity into v_species_rarity from public.species where id = v_species_id;

  insert into public.pets (owner_id, species_id, rarity)
  values (p_user_id, v_species_id, v_species_rarity)
  returning id into v_pet_id;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at)
  values
    (p_user_id, v_pet_id, v_tutorial_zone_id, 'in_progress', true, now(), now() + interval '10 minutes');
end;
$$;

revoke all on function public.grant_starter_pet_and_tutorial(uuid) from public;
grant execute on function public.grant_starter_pet_and_tutorial(uuid) to authenticated;

-- ── Resolve any of a user's expeditions whose timer has elapsed ─────────
-- Called lazily whenever the app reads a user's expeditions/pets (no
-- background job/cron in this phase) — see the "Notes for future modules"
-- section in the README for the tradeoffs of that approach.
create function public.resolve_due_expeditions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expedition record;
  v_den_size integer;
  v_pet_count integer;
  v_species_id uuid;
  v_species_rarity public.pet_rarity;
  v_new_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  for v_expedition in
    select id, zone_id
    from public.expeditions
    where user_id = p_user_id
      and status = 'in_progress'
      and resolves_at <= now()
    for update
  loop
    v_new_pet_id := null;

    select den_size into v_den_size from public.users where id = p_user_id;
    select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

    -- Den-size cap is enforced here, at expedition-return time, per spec.
    if v_pet_count < v_den_size then
      v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

      if v_species_id is not null then
        select rarity into v_species_rarity from public.species where id = v_species_id;

        insert into public.pets (owner_id, species_id, rarity)
        values (p_user_id, v_species_id, v_species_rarity)
        returning id into v_new_pet_id;
      end if;
    end if;

    update public.expeditions
    set status = 'completed', result_pet_id = v_new_pet_id
    where id = v_expedition.id;
  end loop;
end;
$$;

revoke all on function public.resolve_due_expeditions(uuid) from public;
grant execute on function public.resolve_due_expeditions(uuid) to authenticated;

-- ── Seed data ────────────────────────────────────────────────────────────
-- Placeholder content only (placehold.co images, descriptive-not-fictional
-- names) so the flow is runnable out of the box. Replace/expand via the
-- admin panel once it exists.
insert into public.species (id, name, rarity, image_url) values
  ('00000000-0000-0000-0000-000000000101', 'Starter Species A', 'common', 'https://placehold.co/400x400/000000/FFFFFF/png?text=Species+A'),
  ('00000000-0000-0000-0000-000000000102', 'Starter Species B', 'common', 'https://placehold.co/400x400/000000/FFFFFF/png?text=Species+B'),
  ('00000000-0000-0000-0000-000000000103', 'Starter Species C', 'common', 'https://placehold.co/400x400/000000/FFFFFF/png?text=Species+C');

insert into public.zones (id, name, tier, description, image_url, is_tutorial) values
  (
    '00000000-0000-0000-0000-000000000201',
    'Starter Pool (Placeholder Zone)',
    0,
    'This box is meant to hold this zone''s flavor description, to be written once the admin panel exists.',
    'https://placehold.co/600x400/000000/FFFFFF/png?text=Starter+Zone',
    true
  );

insert into public.zone_pet_pool (zone_id, species_id, drop_weight) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 1),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000102', 1),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000103', 1);
