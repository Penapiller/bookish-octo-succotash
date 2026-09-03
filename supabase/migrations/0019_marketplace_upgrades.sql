-- Three upgrades to the marketplace (0018): a seller picks how long a
-- listing runs and it auto-expires (unlists itself) when time is up,
-- listings can be priced in gems as well as coins, and a listing can
-- offer BOTH a coin price and a gem price at once — the buyer picks
-- whichever they'd rather pay with.

-- ── Expiration ───────────────────────────────────────────────────────
alter type public.listing_status add value 'expired';
-- A brand-new enum value can't be USED (cast as data, not just
-- referenced inside a function body) in the same transaction that adds
-- it — hit this exact issue once already, see the note on
-- 0008_potion_effects_and_brew_timers.sql in the README. Nothing below
-- inserts/updates a row with 'expired' directly (only function bodies,
-- which aren't evaluated until a later call), but the commit costs
-- nothing and removes any doubt.
commit;

alter table public.marketplace_listings add column expires_at timestamptz;

update public.marketplace_listings
set expires_at = coalesce(sold_at, created_at) + interval '3 days'
where expires_at is null;

alter table public.marketplace_listings alter column expires_at set not null;

create index marketplace_listings_expires_at_idx on public.marketplace_listings (expires_at)
  where status = 'active';

comment on column public.marketplace_listings.expires_at is
  'When this listing auto-expires if unsold. Set at creation from the seller''s chosen duration (see create_pet_listing/create_item_listing); enforced lazily by resolve_expired_listings() and re-checked directly in buy_listing(), the same lazy-resolution pattern as resolve_due_expeditions/resolve_due_brews — there is no cron job.';

-- ── Gem pricing ──────────────────────────────────────────────────────
-- price_coins was NOT NULL in 0018 (coins-only); now either price can be
-- set (a listing must offer at least one), so a listing can be
-- coins-only, gems-only, or both — letting the buyer choose.
alter table public.marketplace_listings alter column price_coins drop not null;
alter table public.marketplace_listings drop constraint marketplace_listings_price_coins_check;
alter table public.marketplace_listings add constraint marketplace_listings_price_coins_check
  check (price_coins is null or price_coins > 0);

alter table public.marketplace_listings add column price_gems integer;
alter table public.marketplace_listings add constraint marketplace_listings_price_gems_check
  check (price_gems is null or price_gems > 0);

alter table public.marketplace_listings add constraint marketplace_listings_has_a_price
  check (price_coins is not null or price_gems is not null);

create type public.listing_currency as enum ('coins', 'gems');

-- ── List a pet — now takes an optional gem price and a required
-- duration. Same-signature functions can only gain trailing DEFAULT
-- params via CREATE OR REPLACE (0017 relied on that for create_trade);
-- here price_coins goes from required to optional, which changes the
-- function's meaning enough that a straight drop-and-recreate is
-- clearer than fighting that constraint.
drop function public.create_pet_listing(uuid, uuid, integer);

create function public.create_pet_listing(
  p_seller_id uuid,
  p_pet_id uuid,
  p_price_coins integer,
  p_price_gems integer,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_species_name text;
  v_species_image_url text;
  v_rarity public.rarity_tier;
  v_custom_name text;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if p_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Invalid listing duration.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if exists (
    select 1 from public.marketplace_listings
    where pet_id = p_pet_id and status = 'active'
  ) then
    raise exception 'That pet is already listed.';
  end if;

  select s.name, s.image_url, p.rarity, p.custom_name
  into v_species_name, v_species_image_url, v_rarity, v_custom_name
  from public.pets p
  join public.species s on s.id = p.species_id
  where p.id = p_pet_id and p.owner_id = p_seller_id;

  if not found then
    raise exception 'Pet not found.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at,
    pet_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name
  )
  values (
    p_seller_id, 'pet', p_price_coins, p_price_gems, now() + (p_duration_days || ' days')::interval,
    p_pet_id, v_species_name, v_species_image_url, v_rarity, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

revoke all on function public.create_pet_listing(uuid, uuid, integer, integer, integer) from public;
grant execute on function public.create_pet_listing(uuid, uuid, integer, integer, integer) to authenticated;

-- ── List an item stack — same treatment ─────────────────────────────
drop function public.create_item_listing(uuid, uuid, integer, integer);

create function public.create_item_listing(
  p_seller_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_price_coins integer,
  p_price_gems integer,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_have integer;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if p_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Invalid listing duration.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be at least 1.';
  end if;

  select quantity into v_have
  from public.user_inventory
  where user_id = p_seller_id and item_id = p_item_id;

  if coalesce(v_have, 0) < p_quantity then
    raise exception 'You don''t have that many to list.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at, item_id, item_quantity
  )
  values (
    p_seller_id, 'item', p_price_coins, p_price_gems, now() + (p_duration_days || ' days')::interval,
    p_item_id, p_quantity
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

revoke all on function public.create_item_listing(uuid, uuid, integer, integer, integer, integer) from public;
grant execute on function public.create_item_listing(uuid, uuid, integer, integer, integer, integer) to authenticated;

-- ── Buy a listing — now takes which currency to pay with ────────────
drop function public.buy_listing(uuid, uuid);

create function public.buy_listing(p_buyer_id uuid, p_listing_id uuid, p_currency public.listing_currency)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_buyer record;
  v_seller record;
  v_seller_pet_owner uuid;
  v_seller_item_quantity integer;
  v_price integer;
begin
  if auth.uid() is distinct from p_buyer_id then
    raise exception 'Not authorized';
  end if;

  select * into v_listing from public.marketplace_listings where id = p_listing_id for update;

  if not found then
    raise exception 'Listing not found.';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'This listing is no longer available.';
  end if;

  -- Same non-exception-status pattern as the stale-pet/stale-item checks
  -- below (and respond_to_trade's "declined" in 0015): an exception
  -- here would roll back the expiry update along with it.
  if v_listing.expires_at <= now() then
    update public.marketplace_listings set status = 'expired' where id = p_listing_id;
    return jsonb_build_object('status', 'unavailable', 'reason', 'This listing has expired.');
  end if;

  if v_listing.seller_id = p_buyer_id then
    raise exception 'You can''t buy your own listing.';
  end if;

  if p_currency = 'coins' then
    v_price := v_listing.price_coins;
  else
    v_price := v_listing.price_gems;
  end if;
  if v_price is null then
    raise exception 'This listing is not priced in that currency.';
  end if;

  -- Lock both accounts in a consistent order (by id) so two purchases
  -- involving the same pair of players can never deadlock against each
  -- other — same reasoning as trading's respond_to_trade.
  if v_listing.seller_id < p_buyer_id then
    select * into v_seller from public.users where id = v_listing.seller_id for update;
    select * into v_buyer from public.users where id = p_buyer_id for update;
  else
    select * into v_buyer from public.users where id = p_buyer_id for update;
    select * into v_seller from public.users where id = v_listing.seller_id for update;
  end if;

  if p_currency = 'coins' and v_buyer.coin_balance < v_price then
    raise exception 'You don''t have enough coins for that.';
  end if;
  if p_currency = 'gems' and v_buyer.gem_balance < v_price then
    raise exception 'You don''t have enough gems for that.';
  end if;

  -- Re-verify the seller can still deliver — see the comment on this
  -- same check in the original 0018 buy_listing.
  if v_listing.listing_type = 'pet' then
    select owner_id into v_seller_pet_owner from public.pets where id = v_listing.pet_id for update;

    if v_seller_pet_owner is distinct from v_listing.seller_id then
      update public.marketplace_listings set status = 'cancelled' where id = p_listing_id;
      return jsonb_build_object('status', 'unavailable', 'reason', 'This pet is no longer available.');
    end if;

    update public.pets
    set owner_id = p_buyer_id, folder_id = null, is_for_trade = false
    where id = v_listing.pet_id;
  else
    select quantity into v_seller_item_quantity
    from public.user_inventory
    where user_id = v_listing.seller_id and item_id = v_listing.item_id
    for update;

    if coalesce(v_seller_item_quantity, 0) < v_listing.item_quantity then
      update public.marketplace_listings set status = 'cancelled' where id = p_listing_id;
      return jsonb_build_object(
        'status', 'unavailable',
        'reason', 'This item is no longer available in that quantity.'
      );
    end if;

    update public.user_inventory
    set quantity = quantity - v_listing.item_quantity
    where user_id = v_listing.seller_id and item_id = v_listing.item_id;

    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_buyer_id, v_listing.item_id, v_listing.item_quantity)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + v_listing.item_quantity;
  end if;

  perform public.begin_trusted_user_write();

  if p_currency = 'coins' then
    update public.users set coin_balance = coin_balance - v_price where id = p_buyer_id;
    update public.users set coin_balance = coin_balance + v_price where id = v_listing.seller_id;
  else
    update public.users set gem_balance = gem_balance - v_price where id = p_buyer_id;
    update public.users set gem_balance = gem_balance + v_price where id = v_listing.seller_id;
  end if;

  update public.marketplace_listings
  set status = 'sold', buyer_id = p_buyer_id, sold_at = now()
  where id = p_listing_id;

  return jsonb_build_object('status', 'sold', 'currency', p_currency, 'price', v_price);
end;
$$;

revoke all on function public.buy_listing(uuid, uuid, public.listing_currency) from public;
grant execute on function public.buy_listing(uuid, uuid, public.listing_currency) to authenticated;

-- ── Lazy expiration sweep ────────────────────────────────────────────
-- Same "no cron job, resolve opportunistically on page load" pattern as
-- resolve_due_expeditions/resolve_due_brews — except this one isn't
-- scoped to a single player, since browsing the marketplace needs
-- EVERYONE's expired listings cleared, not just the caller's own. Only
-- ever flips a listing's own status field, so there's no risk in any
-- signed-in player being the one who happens to trigger it.
create function public.resolve_expired_listings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.marketplace_listings
  set status = 'expired'
  where status = 'active' and expires_at <= now();
end;
$$;

revoke all on function public.resolve_expired_listings() from public;
grant execute on function public.resolve_expired_listings() to authenticated;
