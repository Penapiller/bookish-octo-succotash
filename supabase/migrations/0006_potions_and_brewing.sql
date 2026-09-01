-- Potions & brewing (spec Phase 5), plus wiring a brewed potion into
-- expeditions for real, replacing the p_use_potion testing boolean from
-- 0003/0004 with an actual "which potion from your inventory" argument.
--
-- Recipes are fixed and shared — the same list for every player, no
-- per-player discovery/unlock state (per spec: "Fixed recipes only at
-- launch, no player-driven discovery/experimentation"). "Recipes you've
-- found" in the UI is just framing for "the recipe book," not a gated
-- per-user unlock system.
--
-- A potion is just an items row with type = 'potion' (per spec's own
-- note: no separate potions table, only the recipe/effect definition
-- needs one) — brewing consumes ingredient item quantities and adds one
-- to the output potion's quantity, all in user_inventory.

create type public.potion_effect_type as enum ('duration_reduction', 'rarity_boost');

create table public.potion_recipes (
  id uuid primary key default gen_random_uuid(),
  output_potion_item_id uuid not null references public.items (id),
  effect_type public.potion_effect_type not null,
  effect_magnitude numeric not null check (effect_magnitude > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.potion_recipes.effect_magnitude is
  'For duration_reduction: fraction (0-1) shaved off the expedition''s randomized duration roll. rarity_boost is defined but not yet applied anywhere — reserved for when pick_weighted_zone_reward takes a bias input.';

alter table public.potion_recipes enable row level security;

create policy "Potion recipes are viewable by everyone"
  on public.potion_recipes for select
  using (true);

create table public.potion_recipe_ingredients (
  recipe_id uuid not null references public.potion_recipes (id) on delete cascade,
  item_id uuid not null references public.items (id),
  quantity_required integer not null check (quantity_required > 0),
  primary key (recipe_id, item_id)
);

alter table public.potion_recipe_ingredients enable row level security;

create policy "Potion recipe ingredients are viewable by everyone"
  on public.potion_recipe_ingredients for select
  using (true);

-- No insert/update/delete policies on either table: recipes are only
-- managed by the (not yet built) admin panel via the service role.

-- ── Brew: atomically trade ingredients for one potion ───────────────────
create function public.brew_potion(p_user_id uuid, p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_output_item_id uuid;
  v_is_active boolean;
  v_ingredient record;
  v_have integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select output_potion_item_id, is_active into v_output_item_id, v_is_active
  from public.potion_recipes
  where id = p_recipe_id;

  if v_output_item_id is null or not v_is_active then
    raise exception 'Recipe not found or not available.';
  end if;

  -- Lock every ingredient row this recipe needs and verify the player has
  -- enough of all of them BEFORE deducting any of them — otherwise a
  -- recipe with 3 ingredients could partially consume the first two and
  -- then fail on the third, silently wasting items.
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

  insert into public.user_inventory (user_id, item_id, quantity)
  values (p_user_id, v_output_item_id, 1)
  on conflict (user_id, item_id) do update
    set quantity = public.user_inventory.quantity + 1;
end;
$$;

revoke all on function public.brew_potion(uuid, uuid) from public;
grant execute on function public.brew_potion(uuid, uuid) to authenticated;

-- ── Expeditions: swap the p_use_potion testing boolean for a real
-- "which potion from your inventory" argument ───────────────────────────
-- Changing an argument's type isn't something CREATE OR REPLACE can do —
-- it needs the old signature dropped first.
drop function public.start_expedition(uuid, uuid, uuid, boolean);

create function public.start_expedition(
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

    -- Deliberately not filtered on is_active: a recipe being retired from
    -- future brewing shouldn't retroactively brick potions already sitting
    -- in someone's inventory.
    select effect_type, effect_magnitude into v_effect_type, v_effect_magnitude
    from public.potion_recipes
    where output_potion_item_id = p_potion_item_id
    limit 1;

    if v_effect_type is null then
      raise exception 'That item isn''t a usable potion.';
    end if;

    -- Consumed regardless of the expedition's eventual outcome, same as
    -- any other single-use potion — see spec. If anything below this
    -- point still fails, the whole function call (including this
    -- deduction) rolls back together; it isn't spent for nothing.
    update public.user_inventory
    set quantity = quantity - 1
    where user_id = p_user_id and item_id = p_potion_item_id;

    if v_effect_type = 'duration_reduction' then
      v_duration_seconds := greatest(30, round(v_duration_seconds * (1 - v_effect_magnitude))::int);
    end if;
    -- rarity_boost potions are recognized (and still consumed) but have
    -- no effect yet — see the comment on potion_recipes.effect_magnitude.
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds))
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;

revoke all on function public.start_expedition(uuid, uuid, uuid, uuid) from public;
grant execute on function public.start_expedition(uuid, uuid, uuid, uuid) to authenticated;

-- ── Seed: potion items (purple art) + their recipes ─────────────────────
insert into public.items (id, name, type, rarity, image_url, sell_value) values
  ('00000000-0000-0000-0000-000000000401', 'Potion Placeholder A', 'potion', 'common', 'https://placehold.co/400x400/7e22ce/FFFFFF/png?text=Potion+A', 0),
  ('00000000-0000-0000-0000-000000000402', 'Potion Placeholder B', 'potion', 'uncommon', 'https://placehold.co/400x400/7e22ce/FFFFFF/png?text=Potion+B', 0);

insert into public.potion_recipes (id, output_potion_item_id, effect_type, effect_magnitude, is_active) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000401', 'duration_reduction', 0.30, true),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000402', 'duration_reduction', 0.50, true);

insert into public.potion_recipe_ingredients (recipe_id, item_id, quantity_required) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301', 2), -- 2x Item Placeholder A
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000302', 1), -- 1x Item Placeholder B
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000303', 1); -- 1x Item Placeholder C (uncommon — the progression gate)

-- ── Temporary testing bump: den cap 3 -> 25 ─────────────────────────────
-- Requested for easier testing with more pets in flight at once. Lower
-- this back down (new default + an UPDATE for existing accounts, mirroring
-- this migration) once real balancing starts.
alter table public.users alter column den_size set default 25;
update public.users set den_size = 25;
