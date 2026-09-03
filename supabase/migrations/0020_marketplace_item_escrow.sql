-- Item listings now actually escrow the listed quantity out of the
-- seller's inventory at listing time, instead of the sanity-check-only/
-- re-verify-at-purchase pattern used everywhere else in this app
-- (trading's offers, and pet listings here). Two real bugs this fixes
-- at once, both reported from live use:
--
--   1. A player could list the same single item stack in several
--      listings at once — each create_item_listing call only checked
--      the LIVE inventory count, which nothing had ever reduced, so
--      "you have 1, want to list 1?" kept saying yes on the same item
--      three times over.
--   2. An item sitting in an active listing could still be spent
--      elsewhere (e.g. brewing) — the listing looked live and sellable
--      right up until someone actually bought it, at which point
--      buy_listing's "does the seller still have enough" check would
--      have caught it, but the listing itself never reflected reality
--      in the meantime.
--
-- Escrowing at listing time (decrement now, credit back on cancel or
-- expiry, credit the buyer directly on sale — no second decrement)
-- fixes both: the live inventory count immediately reflects what's
-- actually still available to spend/relist, so both the "list it again"
-- check and the "can I still use this?" question everywhere else in the
-- app answer correctly without any of them needing to know about
-- marketplace listings specifically.
--
-- Pets don't need this: a specific pet_id can only ever be in one
-- active listing at a time (see the existing check in
-- create_pet_listing), so the same "double-listed" failure mode can't
-- happen to a pet the way it can to a fungible item stack.

-- ── Backfill: bring already-active item listings in line with the new
-- rule before it's enforced. A listing whose seller still has enough is
-- escrowed for real now (decrement it, same as if it had been escrowed
-- from the start); one whose seller no longer has enough — the exact
-- "used it in brewing while it was listed" scenario this migration
-- fixes — can't be retroactively escrowed without inventing inventory,
-- so it's cancelled instead. ─────────────────────────────────────────
do $$
declare
  v_listing record;
  v_have integer;
begin
  for v_listing in
    select id, seller_id, item_id, item_quantity
    from public.marketplace_listings
    where status = 'active' and listing_type = 'item'
    for update
  loop
    select quantity into v_have
    from public.user_inventory
    where user_id = v_listing.seller_id and item_id = v_listing.item_id
    for update;

    if coalesce(v_have, 0) >= v_listing.item_quantity then
      update public.user_inventory
      set quantity = quantity - v_listing.item_quantity
      where user_id = v_listing.seller_id and item_id = v_listing.item_id;
    else
      update public.marketplace_listings set status = 'cancelled' where id = v_listing.id;
    end if;
  end loop;
end;
$$;

-- ── List an item stack — now escrows for real ───────────────────────
create or replace function public.create_item_listing(
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
  where user_id = p_seller_id and item_id = p_item_id
  for update;

  -- Reflects whatever's left after any of this seller's OTHER active
  -- listings already escrowed their share — real inventory, not a
  -- snapshot — so listing more of the same item than actually remains
  -- unlisted fails here.
  if coalesce(v_have, 0) < p_quantity then
    raise exception 'You don''t have that many to list.';
  end if;

  update public.user_inventory
  set quantity = quantity - p_quantity
  where user_id = p_seller_id and item_id = p_item_id;

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

-- ── Cancel — credits the escrowed quantity back for item listings ──
create or replace function public.cancel_listing(p_user_id uuid, p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.marketplace_listings;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.marketplace_listings
  set status = 'cancelled'
  where id = p_listing_id and seller_id = p_user_id and status = 'active'
  returning * into v_listing;

  if not found then
    raise exception 'Listing not found, already resolved, or not yours to cancel.';
  end if;

  if v_listing.listing_type = 'item' then
    update public.user_inventory
    set quantity = quantity + v_listing.item_quantity
    where user_id = v_listing.seller_id and item_id = v_listing.item_id;
  end if;
end;
$$;

-- ── Buy — item quantity was already escrowed at listing time, so it's
-- a direct credit to the buyer now, no second decrement and no
-- "does the seller still have enough" re-check (nothing could have
-- spent it since it left their live inventory the moment it was
-- listed). Pets are unchanged: still not escrowed, still re-verified
-- against the live owner at purchase time, for the reasons in the
-- comment at the top of this file. ──────────────────────────────────
create or replace function public.buy_listing(p_buyer_id uuid, p_listing_id uuid, p_currency public.listing_currency)
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

  if v_listing.expires_at <= now() then
    update public.marketplace_listings set status = 'expired' where id = p_listing_id;
    if v_listing.listing_type = 'item' then
      update public.user_inventory
      set quantity = quantity + v_listing.item_quantity
      where user_id = v_listing.seller_id and item_id = v_listing.item_id;
    end if;
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

-- ── Lazy expiration sweep — credits escrowed item quantities back ──
create or replace function public.resolve_expired_listings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
begin
  for v_listing in
    select id, listing_type, seller_id, item_id, item_quantity
    from public.marketplace_listings
    where status = 'active' and expires_at <= now()
    for update
  loop
    update public.marketplace_listings set status = 'expired' where id = v_listing.id;

    if v_listing.listing_type = 'item' then
      update public.user_inventory
      set quantity = quantity + v_listing.item_quantity
      where user_id = v_listing.seller_id and item_id = v_listing.item_id;
    end if;
  end loop;
end;
$$;
