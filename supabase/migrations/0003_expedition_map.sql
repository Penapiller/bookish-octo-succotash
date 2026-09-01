-- Expeditions map: lets a player pick an explorable zone on a big map
-- image and send a pet there. Builds on the species/pets/zones/
-- expeditions schema from 0002 (which only covered the fixed tutorial
-- expedition) — this adds player-chosen zones and the start_expedition
-- RPC that actually begins one.
--
-- Scope note: potions/brewing are still a separate future module (no
-- items/inventory exist yet), so "use a potion" here is a boolean testing
-- toggle on start_expedition rather than a real consumed inventory item.
-- It's wired the way the real thing will behave (a duration-reducing,
-- never-guaranteed modifier applied at roll time) so swapping the toggle
-- for a real equipped-potion check later is a small, contained change.

-- ── Zones: where on the map each zone's clickable hotspot sits ─────────
-- Percentages of the map image's rendered width/height, so hotspots stay
-- aligned with the map at any responsive size without needing to know its
-- pixel dimensions.
alter table public.zones add column map_x numeric;
alter table public.zones add column map_y numeric;
alter table public.zones add column map_width numeric;
alter table public.zones add column map_height numeric;

comment on column public.zones.map_x is
  'Left edge of this zone''s clickable map hotspot, as a percentage (0-100) of the map image width.';
comment on column public.zones.map_y is
  'Top edge of this zone''s clickable map hotspot, as a percentage (0-100) of the map image height.';

-- ── More starter-adjacent species, for pool variety across zones ───────
insert into public.species (id, name, rarity, image_url) values
  ('00000000-0000-0000-0000-000000000104', 'Zone Species D', 'common', 'https://placehold.co/400x400/000000/FFFFFF/png?text=Species+D'),
  ('00000000-0000-0000-0000-000000000105', 'Zone Species E', 'uncommon', 'https://placehold.co/400x400/000000/FFFFFF/png?text=Species+E');

-- ── Explorable zones ─────────────────────────────────────────────────────
insert into public.zones (id, name, tier, description, image_url, is_tutorial, map_x, map_y, map_width, map_height) values
  (
    '00000000-0000-0000-0000-000000000202',
    'Zone Placeholder — Meadow',
    1,
    'This box is meant to hold this zone''s flavor description, to be written once the admin panel exists.',
    'https://placehold.co/340x280/2f6b2f/FFFFFF/png?text=Meadow',
    false,
    5, 8, 28, 35
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    'Zone Placeholder — Forest',
    1,
    'This box is meant to hold this zone''s flavor description, to be written once the admin panel exists.',
    'https://placehold.co/360x304/1f4d2e/FFFFFF/png?text=Forest',
    false,
    62, 10, 30, 38
  ),
  (
    '00000000-0000-0000-0000-000000000204',
    'Zone Placeholder — Cave',
    2,
    'This box is meant to hold this zone''s flavor description, to be written once the admin panel exists.',
    'https://placehold.co/420x280/40372b/FFFFFF/png?text=Cave',
    false,
    30, 55, 35, 35
  );

insert into public.zone_pet_pool (zone_id, species_id, drop_weight) values
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 2),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 1),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000102', 1),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', 1),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000104', 1),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000103', 1),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000105', 1);

-- ── Start a player-chosen expedition ────────────────────────────────────
create function public.start_expedition(
  p_user_id uuid,
  p_pet_id uuid,
  p_zone_id uuid,
  p_use_potion boolean default false
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
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  -- Lock the pet row for the duration of this call: two concurrent calls
  -- for the same pet must not both pass the "not already busy" check
  -- below. Also doubles as the ownership check (0 rows = not yours/
  -- doesn't exist).
  perform 1 from public.pets where id = p_pet_id and owner_id = p_user_id for update;
  if not found then
    raise exception 'Pet not found.';
  end if;

  if exists (select 1 from public.expeditions where pet_id = p_pet_id and status = 'in_progress') then
    raise exception 'That pet is already on an expedition.';
  end if;

  select is_active, is_tutorial into v_zone_active, v_zone_is_tutorial
  from public.zones
  where id = p_zone_id;

  if v_zone_active is null or not v_zone_active or v_zone_is_tutorial then
    raise exception 'Zone not found or not available.';
  end if;

  -- Duration is randomized either way — a potion only shifts the range,
  -- never guarantees a specific outcome, per spec. Kept inside 1-3
  -- minutes for easy testing; real zone tiers will widen this later.
  if p_use_potion then
    v_duration_seconds := 60 + floor(random() * 61)::int;  -- 60-120s (1-2 min)
  else
    v_duration_seconds := 120 + floor(random() * 61)::int; -- 120-180s (2-3 min)
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds))
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;

revoke all on function public.start_expedition(uuid, uuid, uuid, boolean) from public;
grant execute on function public.start_expedition(uuid, uuid, uuid, boolean) to authenticated;
