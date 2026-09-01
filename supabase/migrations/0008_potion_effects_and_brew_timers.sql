-- Two additions, both requested together:
--
-- 1. Two new real potion effects (item_find_boost, double_reward_chance),
--    on top of the existing duration_reduction. rarity_boost stays
--    reserved/unimplemented as before — it's a different idea (biasing
--    toward rarer outcomes *within* a pool) from item_find_boost (biasing
--    pet-vs-item at the top level), so it isn't reused for either of these.
-- 2. Brewing becomes timed: potion_brews mirrors expeditions' in_progress
--    -> awaiting_claim -> completed shape (fixed 2-minute timer, not
--    randomized — this is a deliberate recipe pick, not a loot roll).
--    Ingredients are spent at start (mirrors a pet becoming "busy" the
--    moment an expedition starts); the finished potion is granted at
--    claim. One brew at a time per player (one physical stand).
--    brew_potion() from 0006 is replaced by start_brew/resolve_due_brews/
--    claim_brew and is dropped.

alter type public.potion_effect_type add value 'item_find_boost';
alter type public.potion_effect_type add value 'double_reward_chance';

-- Postgres refuses to let a new enum value be used anywhere in the same
-- transaction that added it (function bodies are fine — they're just
-- stored text until called later — but this migration's own seed INSERTs
-- further down cast these two values directly as data, which counts as
-- "using" them). An explicit COMMIT here forces them to land as their own
-- transaction first, regardless of whether this whole file is being sent
-- as one implicit transaction (e.g. pasted as one script into Supabase's
-- SQL Editor) or executed statement-by-statement.
commit;

-- ── Expeditions: room to carry a potion's effect from start to resolve ──
-- start_expedition (which consumes the potion) runs long before
-- resolve_due_expeditions (which does the actual roll, whenever the timer
-- next gets checked) — these columns are how the effect survives that gap.
-- Purely internal bookkeeping; nothing in the app queries them directly.
alter table public.expeditions add column item_find_bias numeric;
alter table public.expeditions add column double_reward_chance numeric;
alter table public.expeditions add column is_double_reward boolean not null default false;

comment on column public.expeditions.item_find_bias is
  'Multiplier applied to item (not pet) weights in the resolve-time roll, from an item_find_boost potion used at start. Null = no bias (1.0).';
comment on column public.expeditions.double_reward_chance is
  'Probability of a bonus second reward, from a double_reward_chance potion used at start. Null = the base 5% chance every non-tutorial expedition has anyway.';
comment on column public.expeditions.is_double_reward is
  'Rolled once at resolve time using the above chance. If true and the player keeps the primary reward, claim_expedition_reward also grants one bonus roll.';

-- ── Reward roll: now takes an optional item-weight bias ─────────────────
-- Adding a defaulted parameter at the end preserves callers using the old
-- one-argument signature — this is a true CREATE OR REPLACE, not a drop +
-- recreate (verified: Postgres only forbids OR REPLACE from changing
-- existing parameter types or the return type, not from appending new
-- defaulted parameters).
create or replace function public.pick_weighted_zone_reward(p_zone_id uuid, p_item_bias numeric default 1.0)
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
      power(random(), 1.0 / (drop_weight * p_item_bias)) as roll
    from public.zone_loot_table
    where zone_id = p_zone_id
  ) combined
  order by roll desc
  limit 1;
$$;

-- ── start_expedition: potions now also record item_find_bias /
-- double_reward_chance onto the row, not just shorten the timer ────────
create or replace function public.start_expedition(
  p_user_id uuid,
  p_pet_id uuid,
  p_zone_id uuid,
  p_potion_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone_active boolean;
  v_zone_is_tutorial boolean;
  v_duration_seconds integer;
  v_expedition_id uuid;
  v_potion_quantity integer;
  v_effect_type public.potion_effect_type;
  v_effect_magnitude numeric;
  v_item_bias numeric;
  v_double_chance numeric;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  perform 1 from public.pets where id = p_pet_id and owner_id = p_user_id for update;
  if not found then
    raise exception 'Pet not found.';
  end if;

  if exists (
    select 1 from public.expeditions
    where pet_id = p_pet_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'That pet is already on an expedition.';
  end if;

  select is_active, is_tutorial into v_zone_active, v_zone_is_tutorial
  from public.zones
  where id = p_zone_id;

  if v_zone_active is null or not v_zone_active or v_zone_is_tutorial then
    raise exception 'Zone not found or not available.';
  end if;

  if exists (
    select 1 from public.expeditions
    where user_id = p_user_id and zone_id = p_zone_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'You already have an expedition active in that area.';
  end if;

  v_duration_seconds := 120 + floor(random() * 61)::int; -- 120-180s (2-3 min) base roll

  if p_potion_item_id is not null then
    select quantity into v_potion_quantity
    from public.user_inventory
    where user_id = p_user_id and item_id = p_potion_item_id
    for update;

    if v_potion_quantity is null or v_potion_quantity < 1 then
      raise exception 'You don''t have that potion.';
    end if;

    select effect_type, effect_magnitude into v_effect_type, v_effect_magnitude
    from public.potion_recipes
    where output_potion_item_id = p_potion_item_id
    limit 1;

    if v_effect_type is null then
      raise exception 'That item isn''t a usable potion.';
    end if;

    update public.user_inventory
    set quantity = quantity - 1
    where user_id = p_user_id and item_id = p_potion_item_id;

    if v_effect_type = 'duration_reduction' then
      v_duration_seconds := greatest(30, round(v_duration_seconds * (1 - v_effect_magnitude))::int);
    elsif v_effect_type = 'item_find_boost' then
      v_item_bias := v_effect_magnitude;
    elsif v_effect_type = 'double_reward_chance' then
      v_double_chance := v_effect_magnitude;
    end if;
    -- rarity_boost: recognized and consumed, still no effect applied.
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at, item_find_bias, double_reward_chance)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds), v_item_bias, v_double_chance)
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;

-- ── resolve_due_expeditions: apply the stored bias, roll for a bonus ────
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
  v_item_bias numeric;
  v_double_chance numeric;
  v_is_double boolean;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  for v_expedition in
    select id, zone_id, is_tutorial, item_find_bias, double_reward_chance
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
      v_item_bias := coalesce(v_expedition.item_find_bias, 1.0);
      v_double_chance := coalesce(v_expedition.double_reward_chance, 0.05);

      select species_id, item_id into v_species_id, v_item_id
      from public.pick_weighted_zone_reward(v_expedition.zone_id, v_item_bias);

      v_is_double := random() < v_double_chance;

      update public.expeditions
      set status = 'awaiting_claim',
        pending_species_id = v_species_id,
        pending_item_id = v_item_id,
        is_double_reward = v_is_double
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;

-- ── claim_expedition_reward: grants the bonus roll, reports it back ────
-- Return type changes (uuid -> jsonb), which CREATE OR REPLACE can't do —
-- unlike pick_weighted_zone_reward above, this genuinely needs dropping.
drop function public.claim_expedition_reward(uuid, uuid, boolean);

create function public.claim_expedition_reward(
  p_user_id uuid,
  p_expedition_id uuid,
  p_keep boolean
)
returns jsonb -- {"granted_pet_id": uuid|null, "bonus_kind"?: "pet"|"item", "bonus_name"?: text, "bonus_image_url"?: text}
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_species_id uuid;
  v_pending_item_id uuid;
  v_zone_id uuid;
  v_is_double boolean;
  v_item_bias numeric;
  v_species_rarity public.rarity_tier;
  v_den_size integer;
  v_pet_count integer;
  v_new_pet_id uuid;
  v_kept_item_id uuid;
  v_bonus_kind text;
  v_bonus_species_id uuid;
  v_bonus_item_id uuid;
  v_bonus_rarity public.rarity_tier;
  v_bonus_name text;
  v_bonus_image_url text;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select pending_species_id, pending_item_id, zone_id, is_double_reward, item_find_bias
  into v_pending_species_id, v_pending_item_id, v_zone_id, v_is_double, v_item_bias
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

  -- Bonus roll from a double_reward_chance potion — only when keeping the
  -- primary reward; released along with it otherwise. Reuses the same
  -- item_find_bias the primary roll used, for a coherent effect.
  if p_keep and v_is_double then
    select reward_kind, species_id, item_id
    into v_bonus_kind, v_bonus_species_id, v_bonus_item_id
    from public.pick_weighted_zone_reward(v_zone_id, coalesce(v_item_bias, 1.0));

    if v_bonus_kind = 'pet' and v_bonus_species_id is not null then
      select den_size into v_den_size from public.users where id = p_user_id;
      select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

      if v_pet_count < v_den_size then
        select rarity into v_bonus_rarity from public.species where id = v_bonus_species_id;
        insert into public.pets (owner_id, species_id, rarity) values (p_user_id, v_bonus_species_id, v_bonus_rarity);
        select name, image_url into v_bonus_name, v_bonus_image_url from public.species where id = v_bonus_species_id;
      else
        v_bonus_kind := null; -- den full: bonus silently forfeited, same as any other never-guaranteed outcome
      end if;
    elsif v_bonus_kind = 'item' and v_bonus_item_id is not null then
      insert into public.user_inventory (user_id, item_id, quantity)
      values (p_user_id, v_bonus_item_id, 1)
      on conflict (user_id, item_id) do update
        set quantity = public.user_inventory.quantity + 1;
      select name, image_url into v_bonus_name, v_bonus_image_url from public.items where id = v_bonus_item_id;
    else
      v_bonus_kind := null;
    end if;
  end if;

  update public.expeditions
  set status = 'completed', result_pet_id = v_new_pet_id, result_item_id = v_kept_item_id
  where id = p_expedition_id;

  v_result := jsonb_build_object('granted_pet_id', v_new_pet_id);
  if v_bonus_kind is not null then
    v_result := v_result || jsonb_build_object(
      'bonus_kind', v_bonus_kind,
      'bonus_name', v_bonus_name,
      'bonus_image_url', v_bonus_image_url
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.claim_expedition_reward(uuid, uuid, boolean) from public;
grant execute on function public.claim_expedition_reward(uuid, uuid, boolean) to authenticated;

-- ── Brewing becomes timed ────────────────────────────────────────────────
create type public.brew_status as enum ('in_progress', 'awaiting_claim', 'completed');

create table public.potion_brews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  recipe_id uuid not null references public.potion_recipes (id),
  status public.brew_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  resolves_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index potion_brews_user_status_idx on public.potion_brews (user_id, status, resolves_at);

alter table public.potion_brews enable row level security;

create policy "Users can view own brews"
  on public.potion_brews for select
  using (auth.uid() = user_id);

-- No insert/update policies: brews are only created/resolved/claimed
-- through the security-definer functions below.

drop function if exists public.brew_potion(uuid, uuid);

create function public.start_brew(p_user_id uuid, p_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_output_item_id uuid;
  v_is_active boolean;
  v_ingredient record;
  v_have integer;
  v_brew_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  -- One brew at a time — it's a single physical stand.
  if exists (
    select 1 from public.potion_brews
    where user_id = p_user_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'You already have a potion brewing.';
  end if;

  select output_potion_item_id, is_active into v_output_item_id, v_is_active
  from public.potion_recipes
  where id = p_recipe_id;

  if v_output_item_id is null or not v_is_active then
    raise exception 'Recipe not found or not available.';
  end if;

  -- Same "verify every ingredient before deducting any of them" pattern
  -- as the old brew_potion, so a multi-ingredient recipe can't partially
  -- consume items on a failed brew.
  for v_ingredient in
    select item_id, quantity_required
    from public.potion_recipe_ingredients
    where recipe_id = p_recipe_id
  loop
    select quantity into v_have
    from public.user_inventory
    where user_id = p_user_id and item_id = v_ingredient.item_id
    for update;

    if v_have is null or v_have < v_ingredient.quantity_required then
      raise exception 'Missing ingredients for this recipe.';
    end if;
  end loop;

  update public.user_inventory
  set quantity = user_inventory.quantity - pri.quantity_required
  from public.potion_recipe_ingredients pri
  where pri.recipe_id = p_recipe_id
    and user_inventory.user_id = p_user_id
    and user_inventory.item_id = pri.item_id;

  insert into public.potion_brews (user_id, recipe_id, status, started_at, resolves_at)
  values (p_user_id, p_recipe_id, 'in_progress', now(), now() + interval '2 minutes')
  returning id into v_brew_id;

  return v_brew_id;
end;
$$;

revoke all on function public.start_brew(uuid, uuid) from public;
grant execute on function public.start_brew(uuid, uuid) to authenticated;

create function public.resolve_due_brews(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  update public.potion_brews
  set status = 'awaiting_claim'
  where user_id = p_user_id and status = 'in_progress' and resolves_at <= now();
end;
$$;

revoke all on function public.resolve_due_brews(uuid) from public;
grant execute on function public.resolve_due_brews(uuid) to authenticated;

create function public.claim_brew(p_user_id uuid, p_brew_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_output_item_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select recipe_id into v_recipe_id
  from public.potion_brews
  where id = p_brew_id and user_id = p_user_id and status = 'awaiting_claim'
  for update;

  if not found then
    raise exception 'No finished potion waiting to be claimed for this brew.';
  end if;

  select output_potion_item_id into v_output_item_id
  from public.potion_recipes
  where id = v_recipe_id;

  insert into public.user_inventory (user_id, item_id, quantity)
  values (p_user_id, v_output_item_id, 1)
  on conflict (user_id, item_id) do update
    set quantity = public.user_inventory.quantity + 1;

  update public.potion_brews set status = 'completed' where id = p_brew_id;
end;
$$;

revoke all on function public.claim_brew(uuid, uuid) from public;
grant execute on function public.claim_brew(uuid, uuid) to authenticated;

-- ── Seed: two new potions demonstrating the new effects ─────────────────
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000404', 'Potion Placeholder D', 'potion', 'uncommon', 'https://placehold.co/400x400/7e22ce/FFFFFF/png?text=Potion+D', 0),
  ('00000000-0000-0000-0000-000000000405', 'Potion Placeholder E', 'potion', 'rare', 'https://placehold.co/400x400/7e22ce/FFFFFF/png?text=Potion+E', 0);

insert into public.potion_recipes (id, output_potion_item_id, effect_type, effect_magnitude, is_active) values
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000404', 'item_find_boost', 2.0, true),
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000405', 'double_reward_chance', 0.5, true);

insert into public.potion_recipe_ingredients (recipe_id, item_id, quantity_required) values
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000302', 2), -- 2x Item Placeholder B
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000301', 1), -- 1x Item Placeholder A
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000303', 1); -- 1x Item Placeholder C
