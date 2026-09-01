-- Two behavior changes to non-tutorial expeditions, both scoped to the
-- expeditions map (the fixed tutorial expedition on the profile page is
-- untouched — it still auto-grants immediately on resolution, since it's
-- a one-time onboarding step, not something the player picks):
--
-- 1. Only one active expedition per (player, zone) at a time — you can't
--    pile multiple pets into the same area concurrently.
-- 2. Resolving a non-tutorial expedition's timer no longer auto-grants
--    the reward. It rolls the species and parks the result on the
--    expedition row (status = 'awaiting_claim'), then waits for the
--    player to reopen that zone and explicitly claim_expedition_reward
--    (keep or release) — so returning to a zone is a real "what did I
--    get" moment instead of the pet silently appearing.

alter type public.expedition_status add value 'awaiting_claim';

alter table public.expeditions add column pending_species_id uuid references public.species (id);

comment on column public.expeditions.pending_species_id is
  'Species rolled when a non-tutorial expedition''s timer elapsed, held pending the player''s keep/release choice via claim_expedition_reward. Always null for tutorial expeditions (which still grant immediately) and for expeditions still in_progress.';

-- ── Resolution: tutorial still auto-grants; everything else awaits claim ──
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
  v_species_rarity public.pet_rarity;
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
      -- The roll happens now (elapse time), not at claim time — fixed
      -- once resolved, so re-opening the zone or clicking around can't
      -- reroll it. Only whether it becomes an actual pet is deferred.
      v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

      update public.expeditions
      set status = 'awaiting_claim', pending_species_id = v_species_id
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;

-- ── Starting an expedition: add the one-per-zone lock, and "busy" now
-- also covers awaiting_claim (the sent pet isn't back until claimed) ────
create or replace function public.start_expedition(
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

-- ── Claim: the player's explicit keep/release choice ────────────────────
create function public.claim_expedition_reward(
  p_user_id uuid,
  p_expedition_id uuid,
  p_keep boolean
)
returns uuid  -- the newly granted pet's id, if kept; null otherwise
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_species_id uuid;
  v_species_rarity public.pet_rarity;
  v_den_size integer;
  v_pet_count integer;
  v_new_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select pending_species_id into v_pending_species_id
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
  end if;

  update public.expeditions
  set status = 'completed', result_pet_id = v_new_pet_id
  where id = p_expedition_id;

  return v_new_pet_id;
end;
$$;

revoke all on function public.claim_expedition_reward(uuid, uuid, boolean) from public;
grant execute on function public.claim_expedition_reward(uuid, uuid, boolean) to authenticated;
