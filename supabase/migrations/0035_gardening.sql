-- Gardening: a plot grid per player, seeds (specific or pooled), optional
-- fertilizer, an 8-hour watering cadence that pauses growth when missed
-- and a 72-hour-overdue wilt, 3 real-day grow time split into 3 visual
-- stages, and a harvest that grants an item + coins (fertilizer can
-- speed growth, deter a pest penalty, or double the coin payout).
--
-- Mirrors existing patterns throughout rather than inventing new ones:
-- weighted pool picks (zone_pet_pool/pick_weighted_zone_species), the
-- in_progress/awaiting_claim-style status + lazy resolve_due_* function
-- (expeditions/potion_brews), and the escalating-cost capacity expansion
-- (den_size/expand_den) — this file's expand_garden is that same shape.

-- ── New item types ───────────────────────────────────────────────────
alter type public.item_type add value 'seed';
alter type public.item_type add value 'fertilizer';

-- New enum values can't be used as data in the same transaction that
-- added them (function bodies are fine — only this migration's own
-- later INSERTs count as "using" them) — see 0008's identical note.
commit;

-- ── Garden plants (the "species" catalog for crops) ─────────────────
create table public.garden_plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_stage1_url text,
  image_stage2_url text,
  image_stage3_url text,
  produce_item_id uuid references public.items (id),
  produce_quantity_min integer not null default 1 check (produce_quantity_min >= 1),
  produce_quantity_max integer not null default 1 check (produce_quantity_max >= produce_quantity_min),
  base_coin_yield integer not null default 0 check (base_coin_yield >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.garden_plants is
  'What a seed can grow into. Three stage images shown as the plant ages (see resolve_due_garden/the app''s stage calc); produce_item_id + a coins payout are granted on harvest.';

alter table public.garden_plants enable row level security;

create policy "Garden plants are viewable by everyone"
  on public.garden_plants for select
  using (true);

-- No insert/update/delete policy: managed by the admin panel via the
-- service role, same as species/items/zones.

-- ── Seed pools ───────────────────────────────────────────────────────
-- Exactly the same shape as zone_pet_pool, and deliberately reused for
-- BOTH kinds of seed the spec calls for: a "plants one specific plant"
-- seed is just a pool with one row (the weight is irrelevant with only
-- one option), and a "plants from a pool" seed has several. One weighted
-- pick function (pick_weighted_seed_plant, below) covers both — no
-- separate "seed kind" flag or branching needed anywhere in the app.
create table public.seed_plants (
  seed_item_id uuid not null references public.items (id) on delete cascade,
  plant_id uuid not null references public.garden_plants (id) on delete cascade,
  drop_weight integer not null default 1 check (drop_weight > 0),
  primary key (seed_item_id, plant_id)
);

alter table public.seed_plants enable row level security;

create policy "Seed pools are viewable by everyone"
  on public.seed_plants for select
  using (true);

-- ── Fertilizer effects ───────────────────────────────────────────────
create type public.fertilizer_effect_type as enum (
  'grow_speed_boost',    -- fraction shaved off total grow duration
  'pest_deterrence',     -- fraction reduction of the base pest chance
  'double_coin_chance'   -- chance harvest's coin payout is doubled
);

create table public.fertilizer_effects (
  item_id uuid not null references public.items (id) on delete cascade,
  effect_type public.fertilizer_effect_type not null,
  effect_magnitude numeric not null check (effect_magnitude > 0),
  primary key (item_id, effect_type)
);

comment on table public.fertilizer_effects is
  'A fertilizer item can carry more than one effect (e.g. a premium blend); plant_seed() applies every row for the fertilizer used.';

alter table public.fertilizer_effects enable row level security;

create policy "Fertilizer effects are viewable by everyone"
  on public.fertilizer_effects for select
  using (true);

-- ── Garden capacity ──────────────────────────────────────────────────
alter table public.users add column garden_rows integer not null default 3;

comment on column public.users.garden_rows is
  'Rows of 5 plots the player can plant in. Starts at 3 (15 plots); expand_garden() adds one row at a time at an escalating coin cost, same convention as den_size/expand_den.';

-- garden_rows joins the same privileged-column guard as den_size/coin_
-- balance/etc — a player must never set this with a plain client UPDATE,
-- only through expand_garden() below (which uses the same trusted-write
-- escape hatch as expand_den). Same signature as every prior version of
-- this function, so CREATE OR REPLACE is safe.
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
    new.coin_balance := old.coin_balance;
    new.gem_balance := old.gem_balance;
    new.den_size := old.den_size;
    new.garden_rows := old.garden_rows;
    new.google_sub := old.google_sub;
    new.email := old.email;
    new.starter_granted := old.starter_granted;
  end if;
  return new;
end;
$$;

-- Cost curve: 300 coins for the first extra row, x1.5 per row already
-- bought (300, 450, 675, ...) — same escalating-cost shape as expand_den,
-- just a cheaper base since a row is a smaller capacity bump (5 plots)
-- than a den expansion (25 slots).
create function public.expand_garden(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garden_rows integer;
  v_coin_balance integer;
  v_rows_bought integer;
  v_cost integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select garden_rows, coin_balance into v_garden_rows, v_coin_balance
  from public.users
  where id = p_user_id
  for update;

  v_rows_bought := greatest(0, v_garden_rows - 3);
  v_cost := round(300 * power(1.5::numeric, v_rows_bought::numeric))::integer;

  if v_coin_balance < v_cost then
    raise exception 'Not enough coins: this expansion costs % coins, you have %', v_cost, v_coin_balance;
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set coin_balance = coin_balance - v_cost, garden_rows = garden_rows + 1
  where id = p_user_id;

  return jsonb_build_object('new_garden_rows', v_garden_rows + 1, 'coins_spent', v_cost);
end;
$$;

revoke all on function public.expand_garden(uuid) from public;
grant execute on function public.expand_garden(uuid) to authenticated;

-- ── Plantings ────────────────────────────────────────────────────────
create type public.garden_planting_status as enum ('growing', 'ready', 'wilted');

create table public.garden_plantings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- 0-based, linear across every plot the player owns (row = plot_index
  -- / 5, column = plot_index % 5) — no separate "plots" table, since an
  -- empty plot is simply the absence of a row here for that index.
  plot_index integer not null check (plot_index >= 0),
  plant_id uuid not null references public.garden_plants (id),
  fertilizer_item_id uuid references public.items (id),
  status public.garden_planting_status not null default 'growing',
  planted_at timestamptz not null default now(),
  -- The base grow duration this planting was given at plant time (after
  -- any grow_speed_boost / pest penalty) — fixed for the life of the
  -- planting; only grow_completes_at moves (see water_plant), and stage
  -- boundaries are simply thirds of this value. Kept explicit rather
  -- than re-derived, since grow_completes_at drifting from planted_at
  -- over time (each missed-watering pause pushes it later) means
  -- "grow_completes_at - planted_at" stops meaning the original duration.
  total_duration_seconds integer not null check (total_duration_seconds > 0),
  last_watered_at timestamptz not null default now(),
  next_water_needed_at timestamptz not null,
  grow_completes_at timestamptz not null,
  is_pest_affected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, plot_index)
);

create index garden_plantings_user_status_idx on public.garden_plantings (user_id, status);

comment on column public.garden_plantings.grow_completes_at is
  'When this planting finishes growing, ASSUMING it is watered on time from here on. water_plant() pushes this forward by exactly however long the plant sat overdue needing water, so a neglected plant never finishes "on schedule" — see resolve_due_garden for how this and next_water_needed_at combine to decide ready vs wilted.';

alter table public.garden_plantings enable row level security;

create policy "Users can view own garden plantings"
  on public.garden_plantings for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: only plant_seed/water_plant/
-- harvest_plot (all security definer, below) ever touch this table.

-- ── Weighted pick over a seed's pool ─────────────────────────────────
-- Identical Efraimidis-Spirakis weighted-sample shape as
-- pick_weighted_zone_species (0003_expedition_map.sql).
create function public.pick_weighted_seed_plant(p_seed_item_id uuid)
returns uuid
language sql
as $$
  select plant_id
  from public.seed_plants
  where seed_item_id = p_seed_item_id
  order by power(random(), 1.0 / drop_weight) desc
  limit 1;
$$;

-- ── Plant a seed into a plot ─────────────────────────────────────────
create function public.plant_seed(
  p_user_id uuid,
  p_plot_index integer,
  p_seed_item_id uuid,
  p_fertilizer_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garden_rows integer;
  v_seed_type public.item_type;
  v_seed_quantity integer;
  v_fertilizer_type public.item_type;
  v_fertilizer_quantity integer;
  v_plant_id uuid;
  v_duration_seconds integer := 3 * 24 * 60 * 60; -- 3 days, base
  v_pest_chance numeric := 0.15; -- base 15% chance, before any deterrence
  v_is_pest_affected boolean := false;
  v_effect record;
  v_planting_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select garden_rows into v_garden_rows from public.users where id = p_user_id;
  if p_plot_index < 0 or p_plot_index >= v_garden_rows * 5 then
    raise exception 'That plot isn''t unlocked yet.';
  end if;

  if exists (select 1 from public.garden_plantings where user_id = p_user_id and plot_index = p_plot_index) then
    raise exception 'That plot is already planted.';
  end if;

  select type into v_seed_type from public.items where id = p_seed_item_id;
  if v_seed_type is distinct from 'seed' then
    raise exception 'That item isn''t a seed.';
  end if;

  select quantity into v_seed_quantity
  from public.user_inventory
  where user_id = p_user_id and item_id = p_seed_item_id
  for update;

  if v_seed_quantity is null or v_seed_quantity < 1 then
    raise exception 'You don''t have that seed.';
  end if;

  v_plant_id := public.pick_weighted_seed_plant(p_seed_item_id);
  if v_plant_id is null then
    raise exception 'That seed has nothing planted in its pool.';
  end if;

  if p_fertilizer_item_id is not null then
    select type into v_fertilizer_type from public.items where id = p_fertilizer_item_id;
    if v_fertilizer_type is distinct from 'fertilizer' then
      raise exception 'That item isn''t fertilizer.';
    end if;

    select quantity into v_fertilizer_quantity
    from public.user_inventory
    where user_id = p_user_id and item_id = p_fertilizer_item_id
    for update;

    if v_fertilizer_quantity is null or v_fertilizer_quantity < 1 then
      raise exception 'You don''t have that fertilizer.';
    end if;

    for v_effect in
      select effect_type, effect_magnitude from public.fertilizer_effects where item_id = p_fertilizer_item_id
    loop
      if v_effect.effect_type = 'grow_speed_boost' then
        v_duration_seconds := greatest(3600, round(v_duration_seconds * (1 - v_effect.effect_magnitude))::int);
      elsif v_effect.effect_type = 'pest_deterrence' then
        v_pest_chance := v_pest_chance * greatest(0, 1 - v_effect.effect_magnitude);
      end if;
      -- double_coin_chance is read again at harvest time (harvest_plot),
      -- not applied here.
    end loop;
  end if;

  -- Rolled once, at plant time — same "roll a modifier once, apply it
  -- for the life of the thing" convention as expeditions'
  -- is_double_reward. A pest strike adds a flat day rather than
  -- multiplying, so it reads as "bad luck cost you a day," not a
  -- percentage most players can't eyeball.
  if random() < v_pest_chance then
    v_duration_seconds := v_duration_seconds + 24 * 60 * 60;
    v_is_pest_affected := true;
  end if;

  update public.user_inventory set quantity = quantity - 1
  where user_id = p_user_id and item_id = p_seed_item_id;

  if p_fertilizer_item_id is not null then
    update public.user_inventory set quantity = quantity - 1
    where user_id = p_user_id and item_id = p_fertilizer_item_id;
  end if;

  insert into public.garden_plantings (
    user_id, plot_index, plant_id, fertilizer_item_id, status,
    planted_at, total_duration_seconds, last_watered_at, next_water_needed_at, grow_completes_at,
    is_pest_affected
  )
  values (
    p_user_id, p_plot_index, v_plant_id, p_fertilizer_item_id, 'growing',
    now(), v_duration_seconds, now(), now() + interval '8 hours', now() + make_interval(secs => v_duration_seconds),
    v_is_pest_affected
  )
  returning id into v_planting_id;

  return v_planting_id;
end;
$$;

revoke all on function public.plant_seed(uuid, integer, uuid, uuid) from public;
grant execute on function public.plant_seed(uuid, integer, uuid, uuid) to authenticated;

-- ── Water a plot ─────────────────────────────────────────────────────
create function public.water_plant(p_user_id uuid, p_planting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.garden_planting_status;
  v_last_watered_at timestamptz;
  v_next_water_needed_at timestamptz;
  v_overdue_gap interval;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select status, last_watered_at, next_water_needed_at
  into v_status, v_last_watered_at, v_next_water_needed_at
  from public.garden_plantings
  where id = p_planting_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Planting not found.';
  end if;

  if v_status <> 'growing' then
    raise exception 'This plant doesn''t need watering.';
  end if;

  if now() < v_last_watered_at + interval '8 hours' then
    raise exception 'You can only water this once every 8 hours.';
  end if;

  -- Growth was effectively paused for however long this sat overdue —
  -- push completion back by exactly that gap so a late watering never
  -- lets a plant "catch up" for free, but also never permanently loses
  -- more time than it was actually neglected.
  if now() > v_next_water_needed_at then
    v_overdue_gap := now() - v_next_water_needed_at;
    update public.garden_plantings
    set grow_completes_at = grow_completes_at + v_overdue_gap
    where id = p_planting_id;
  end if;

  update public.garden_plantings
  set last_watered_at = now(), next_water_needed_at = now() + interval '8 hours'
  where id = p_planting_id;
end;
$$;

revoke all on function public.water_plant(uuid, uuid) from public;
grant execute on function public.water_plant(uuid, uuid) to authenticated;

-- ── Lazy status resolution ───────────────────────────────────────────
-- Called before every garden read, same convention as
-- resolve_due_expeditions/resolve_due_brews. Order matters: wilt is
-- checked independent of grow_completes_at (a plant neglected past 72h
-- overdue dies regardless of whatever its stale completion timestamp
-- says), and "ready" only fires for a planting that is BOTH past its
-- completion time AND currently not overdue for water — a plant that
-- happens to reach grow_completes_at while thirsty does not silently
-- finish; it has to be watered (and effectively rescheduled forward by
-- water_plant's overdue-gap push) before it can ever be marked ready.
create function public.resolve_due_garden(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.garden_plantings
  set status = 'wilted'
  where user_id = p_user_id
    and status = 'growing'
    and now() > next_water_needed_at + interval '72 hours';

  update public.garden_plantings
  set status = 'ready'
  where user_id = p_user_id
    and status = 'growing'
    and now() >= grow_completes_at
    and now() <= next_water_needed_at;
end;
$$;

revoke all on function public.resolve_due_garden(uuid) from public;
grant execute on function public.resolve_due_garden(uuid) to authenticated;

-- ── Harvest ──────────────────────────────────────────────────────────
create function public.harvest_plot(p_user_id uuid, p_planting_id uuid)
returns jsonb -- {"wilted": true} or {"produce_item_id": uuid, "quantity": int, "coins": int}
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.garden_planting_status;
  v_plant_id uuid;
  v_fertilizer_item_id uuid;
  v_produce_item_id uuid;
  v_qty_min integer;
  v_qty_max integer;
  v_base_coins integer;
  v_quantity integer;
  v_coins integer;
  v_effect record;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select status, plant_id, fertilizer_item_id
  into v_status, v_plant_id, v_fertilizer_item_id
  from public.garden_plantings
  where id = p_planting_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Planting not found.';
  end if;

  if v_status = 'growing' then
    raise exception 'This plant isn''t ready to harvest yet.';
  end if;

  if v_status = 'wilted' then
    delete from public.garden_plantings where id = p_planting_id;
    return jsonb_build_object('wilted', true);
  end if;

  select produce_item_id, produce_quantity_min, produce_quantity_max, base_coin_yield
  into v_produce_item_id, v_qty_min, v_qty_max, v_base_coins
  from public.garden_plants
  where id = v_plant_id;

  v_quantity := v_qty_min + floor(random() * (v_qty_max - v_qty_min + 1))::int;
  v_coins := v_base_coins;

  if v_fertilizer_item_id is not null then
    for v_effect in
      select effect_magnitude from public.fertilizer_effects
      where item_id = v_fertilizer_item_id and effect_type = 'double_coin_chance'
    loop
      if random() < v_effect.effect_magnitude then
        v_coins := v_coins * 2;
      end if;
    end loop;
  end if;

  if v_produce_item_id is not null and v_quantity > 0 then
    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_user_id, v_produce_item_id, v_quantity)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + v_quantity;
  end if;

  if v_coins > 0 then
    perform public.begin_trusted_user_write();
    update public.users set coin_balance = coin_balance + v_coins where id = p_user_id;
  end if;

  delete from public.garden_plantings where id = p_planting_id;

  v_result := jsonb_build_object('coins', v_coins);
  if v_produce_item_id is not null and v_quantity > 0 then
    v_result := v_result || jsonb_build_object('produce_item_id', v_produce_item_id, 'quantity', v_quantity);
  end if;

  return v_result;
end;
$$;

revoke all on function public.harvest_plot(uuid, uuid) from public;
grant execute on function public.harvest_plot(uuid, uuid) to authenticated;

-- ── Seed data: 2 crops, 2 seeds (one specific, one pooled), 2 fertilizers ─
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000601', 'Carrot', 'ingredient', 'common', 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Carrot', 8),
  ('00000000-0000-0000-0000-000000000602', 'Sunflower', 'ingredient', 'common', 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Sunflower', 10),
  ('00000000-0000-0000-0000-000000000603', 'Pumpkin', 'ingredient', 'uncommon', 'https://placehold.co/400x400/15803d/FFFFFF/png?text=Pumpkin', 20);

insert into public.garden_plants (id, name, image_stage1_url, image_stage2_url, image_stage3_url, produce_item_id, produce_quantity_min, produce_quantity_max, base_coin_yield) values
  ('00000000-0000-0000-0000-000000000701', 'Carrot Plant',
    'https://placehold.co/400x400/854d0e/FFFFFF/png?text=Sprout',
    'https://placehold.co/400x400/854d0e/FFFFFF/png?text=Growing',
    'https://placehold.co/400x400/15803d/FFFFFF/png?text=Carrot',
    '00000000-0000-0000-0000-000000000601', 2, 4, 10),
  ('00000000-0000-0000-0000-000000000702', 'Sunflower Plant',
    'https://placehold.co/400x400/854d0e/FFFFFF/png?text=Sprout',
    'https://placehold.co/400x400/854d0e/FFFFFF/png?text=Growing',
    'https://placehold.co/400x400/15803d/FFFFFF/png?text=Sunflower',
    '00000000-0000-0000-0000-000000000602', 1, 2, 15),
  ('00000000-0000-0000-0000-000000000703', 'Pumpkin Plant',
    'https://placehold.co/400x400/854d0e/FFFFFF/png?text=Sprout',
    'https://placehold.co/400x400/854d0e/FFFFFF/png?text=Growing',
    'https://placehold.co/400x400/15803d/FFFFFF/png?text=Pumpkin',
    '00000000-0000-0000-0000-000000000603', 1, 1, 25);

-- Seeds — brown placeholder art, per the request that this new item type
-- read as visually distinct (green = ingredient, purple = potion, brown
-- = seed, and yellow below for fertilizer).
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000801', 'Carrot Seed', 'seed', 'common', 'https://placehold.co/400x400/78350f/FFFFFF/png?text=Carrot+Seed', 3),
  ('00000000-0000-0000-0000-000000000802', 'Wildflower Seed Packet', 'seed', 'common', 'https://placehold.co/400x400/78350f/FFFFFF/png?text=Mystery+Seed', 5);

-- Carrot Seed: specific — a pool of exactly one plant.
insert into public.seed_plants (seed_item_id, plant_id, drop_weight) values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000701', 1);

-- Wildflower Seed Packet: pooled — could come up either flower, pumpkin
-- weighted rarer.
insert into public.seed_plants (seed_item_id, plant_id, drop_weight) values
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000702', 3),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000703', 1);

-- Fertilizers — yellow placeholder art.
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000901', 'Growth Fertilizer', 'fertilizer', 'common', 'https://placehold.co/400x400/ca8a04/FFFFFF/png?text=Growth+Fert', 6),
  ('00000000-0000-0000-0000-000000000902', 'Lucky Fertilizer', 'fertilizer', 'uncommon', 'https://placehold.co/400x400/ca8a04/FFFFFF/png?text=Lucky+Fert', 12);

insert into public.fertilizer_effects (item_id, effect_type, effect_magnitude) values
  ('00000000-0000-0000-0000-000000000901', 'grow_speed_boost', 0.25),
  ('00000000-0000-0000-0000-000000000901', 'pest_deterrence', 0.75),
  ('00000000-0000-0000-0000-000000000902', 'double_coin_chance', 0.5);
