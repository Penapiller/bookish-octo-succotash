-- Items + inventory (spec Phase 3), plus wiring zones to sometimes drop an
-- item instead of a pet. Items here are crafting ingredients only — no
-- pet-decoration/equip mechanic (that's a separate future accessories
-- system the spec describes for pet_accessories, not this table).
--
-- The rarity enum was named pet_rarity when only pets used it; items need
-- the same tiers, so it's renamed to the generic rarity_tier here. This is
-- a metadata-only rename — every existing column keeps its data.
alter type public.pet_rarity rename to rarity_tier;

create type public.item_type as enum ('ingredient', 'cosmetic', 'potion');

-- ── Items ────────────────────────────────────────────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.item_type not null default 'ingredient',
  rarity public.rarity_tier not null default 'common',
  image_url text,
  sell_value integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.items is
  'Crafting ingredients (and, later, cosmetics/potions — see item_type). Not equippable on pets.';

alter table public.items enable row level security;

create policy "Items are viewable by everyone"
  on public.items for select
  using (true);

-- No insert/update/delete policy yet: items are only managed by the (not
-- yet built) admin panel via the service role, which bypasses RLS.

-- ── User inventory ───────────────────────────────────────────────────────
create table public.user_inventory (
  user_id uuid not null references public.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  primary key (user_id, item_id)
);

alter table public.user_inventory enable row level security;

create policy "Users can view own inventory"
  on public.user_inventory for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: quantities are only ever changed by
-- security-definer functions (claim_expedition_reward today; brewing/
-- selling will add their own later), never a direct client write.

-- ── Zone loot table (items a zone can drop) ─────────────────────────────
create table public.zone_loot_table (
  zone_id uuid not null references public.zones (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  drop_weight integer not null default 1 check (drop_weight > 0),
  primary key (zone_id, item_id)
);

alter table public.zone_loot_table enable row level security;

create policy "Zone loot tables are viewable by everyone"
  on public.zone_loot_table for select
  using (true);

-- ── Expeditions: room for an item outcome alongside a pet outcome ───────
alter table public.expeditions add column pending_item_id uuid references public.items (id);
alter table public.expeditions add column result_item_id uuid references public.items (id);

comment on column public.expeditions.pending_item_id is
  'Item rolled when a non-tutorial expedition''s timer elapsed, mutually exclusive with pending_species_id. Held pending claim, same as pending_species_id.';
comment on column public.expeditions.result_item_id is
  'Set instead of result_pet_id when the player kept an item reward rather than a pet.';

-- ── Shared weighted roll across BOTH a zone's pet pool and loot table ──
-- A zone "sometimes" dropping an item instead of a pet isn't a separate
-- probability knob — it falls out of combining zone_pet_pool and
-- zone_loot_table into one weighted draw (same Efraimidis-Spirakis
-- algorithm as pick_weighted_zone_species). Admins tune the pet/item mix
-- later purely via each row's drop_weight, in whichever table.
create function public.pick_weighted_zone_reward(p_zone_id uuid)
returns table (reward_kind text, species_id uuid, item_id uuid)
language sql
as $$
  select reward_kind, species_id, item_id
  from (
    select 'pet' as reward_kind, species_id, null::uuid as item_id,
      power(random(), 1.0 / drop_weight) as roll
    from public.zone_pet_pool
    where zone_id = p_zone_id
    union all
    select 'item' as reward_kind, null::uuid as species_id, item_id,
      power(random(), 1.0 / drop_weight) as roll
    from public.zone_loot_table
    where zone_id = p_zone_id
  ) combined
  order by roll desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_reward(uuid) from public;

-- ── Resolution: non-tutorial branch now rolls pet-or-item ───────────────
-- The tutorial branch is untouched below — it deliberately keeps using
-- pick_weighted_zone_species (pet-only), since the tutorial's whole point
-- is guaranteeing a second starter pet, never an item.
create or replace function public.resolve_due_expeditions(p_user_id uuid)
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
  v_item_id uuid;
  v_species_rarity public.rarity_tier;
  v_new_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  for v_expedition in
    select id, zone_id, is_tutorial
    from public.expeditions
    where user_id = p_user_id
      and status = 'in_progress'
      and resolves_at <= now()
    for update
  loop
    if v_expedition.is_tutorial then
      v_new_pet_id := null;

      select den_size into v_den_size from public.users where id = p_user_id;
      select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

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
    else
      select species_id, item_id into v_species_id, v_item_id
      from public.pick_weighted_zone_reward(v_expedition.zone_id);

      update public.expeditions
      set status = 'awaiting_claim', pending_species_id = v_species_id, pending_item_id = v_item_id
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;

-- ── Claim: now grants either a pet or an item ───────────────────────────
create or replace function public.claim_expedition_reward(
  p_user_id uuid,
  p_expedition_id uuid,
  p_keep boolean
)
returns uuid  -- the newly granted pet's id, if a pet was kept; null otherwise
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_species_id uuid;
  v_pending_item_id uuid;
  v_species_rarity public.rarity_tier;
  v_den_size integer;
  v_pet_count integer;
  v_new_pet_id uuid;
  v_kept_item_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select pending_species_id, pending_item_id into v_pending_species_id, v_pending_item_id
  from public.expeditions
  where id = p_expedition_id and user_id = p_user_id and status = 'awaiting_claim'
  for update;

  if not found then
    raise exception 'No reward waiting to be claimed for this expedition.';
  end if;

  if p_keep and v_pending_species_id is not null then
    select den_size into v_den_size from public.users where id = p_user_id;
    select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

    if v_pet_count >= v_den_size then
      raise exception 'Your den is full — expand it or release this pet instead.';
    end if;

    select rarity into v_species_rarity from public.species where id = v_pending_species_id;

    insert into public.pets (owner_id, species_id, rarity)
    values (p_user_id, v_pending_species_id, v_species_rarity)
    returning id into v_new_pet_id;
  elsif p_keep and v_pending_item_id is not null then
    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_user_id, v_pending_item_id, 1)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + 1;

    v_kept_item_id := v_pending_item_id;
  end if;

  update public.expeditions
  set status = 'completed', result_pet_id = v_new_pet_id, result_item_id = v_kept_item_id
  where id = p_expedition_id;

  return v_new_pet_id;
end;
$$;

-- ── Recolor existing species art blue, so pets are visually distinct
-- from the new (green) items everywhere they appear side by side ───────
update public.species set image_url = replace(image_url, '/000000/FFFFFF/', '/1d4ed8/FFFFFF/')
where image_url like 'https://placehold.co/%';

-- ── Seed items (green placeholder art) ──────────────────────────────────
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000301', 'Item Placeholder A', 'ingredient', 'common', 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Item+A', 5),
  ('00000000-0000-0000-0000-000000000302', 'Item Placeholder B', 'ingredient', 'common', 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Item+B', 5),
  ('00000000-0000-0000-0000-000000000303', 'Item Placeholder C', 'ingredient', 'uncommon', 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Item+C', 15);

-- Every explorable (non-tutorial) zone gets a mix of item drops alongside
-- its existing pet pool, so "sometimes an item instead of a pet" actually
-- happens. The tutorial zone (...000201) intentionally gets none.
insert into public.zone_loot_table (zone_id, item_id, drop_weight) values
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000301', 1), -- Meadow
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000301', 1), -- Forest
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000302', 1), -- Forest
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000302', 1), -- Cave
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000303', 2); -- Cave
