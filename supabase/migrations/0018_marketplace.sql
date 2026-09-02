-- Fixed-price marketplace (Flight Rising's Marketplace, not its
-- timed-bid Auction House — a seller sets a price, any buyer purchases
-- the whole listing instantly for that price; no bidding). Coins only —
-- gems have no earn path yet outside admin testing grants, so nothing to
-- spend them on here either.
--
-- One listing = one pet, or one stack of an item — buying an item
-- listing always buys the entire listed quantity at once, not a partial
-- amount (a seller who wants to sell some now and some later just lists
-- twice).
create type public.listing_type as enum ('pet', 'item');
create type public.listing_status as enum ('active', 'sold', 'cancelled');

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users (id) on delete cascade,
  buyer_id uuid references public.users (id),
  listing_type public.listing_type not null,
  price_coins integer not null check (price_coins > 0),
  status public.listing_status not null default 'active',

  -- Pet listings. Display fields are a SNAPSHOT taken at listing time,
  -- not a live join to `pets` — pets has owner-gated RLS (see 0002; the
  -- for-trade carve-out in 0016 doesn't cover listings), and a listing
  -- needs to stay visible/readable to every browsing player regardless
  -- of who currently owns the pet, including long after a sale. Storing
  -- what's being sold directly on the listing sidesteps needing another
  -- RLS policy on `pets` entirely.
  pet_id uuid references public.pets (id),
  pet_species_name text,
  pet_species_image_url text,
  pet_rarity public.rarity_tier,
  pet_custom_name text,

  -- Item listings — no snapshot needed here: `items` (the catalog, not
  -- any one player's stack of it) has been publicly readable since 0005,
  -- so a listing can just join it live for name/image/rarity.
  item_id uuid references public.items (id),
  item_quantity integer,

  created_at timestamptz not null default now(),
  sold_at timestamptz,

  check (
    (listing_type = 'pet' and pet_id is not null and item_id is null and item_quantity is null)
    or
    (listing_type = 'item' and item_id is not null and pet_id is null
     and item_quantity is not null and item_quantity > 0)
  )
);

create index marketplace_listings_active_idx on public.marketplace_listings (listing_type) where status = 'active';
create index marketplace_listings_seller_id_idx on public.marketplace_listings (seller_id);
create index marketplace_listings_buyer_id_idx on public.marketplace_listings (buyer_id);

comment on table public.marketplace_listings is
  'Fixed-price pet/item listings. Written only by create_pet_listing/create_item_listing/cancel_listing/buy_listing below, never a plain client write.';

alter table public.marketplace_listings enable row level security;

create policy "Active listings are viewable by everyone"
  on public.marketplace_listings for select
  to authenticated
  using (status = 'active' or seller_id = auth.uid() or buyer_id = auth.uid());

-- No insert/update/delete policies: every write goes through one of the
-- four functions below, each re-validating auth.uid() itself (same
-- pattern as expeditions/brewing/pet folders/trading).

-- ── List a pet ───────────────────────────────────────────────────────
create function public.create_pet_listing(p_seller_id uuid, p_pet_id uuid, p_price_coins integer)
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

  if p_price_coins <= 0 then
    raise exception 'Price must be at least 1 coin.';
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
    seller_id, listing_type, price_coins,
    pet_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name
  )
  values (
    p_seller_id, 'pet', p_price_coins,
    p_pet_id, v_species_name, v_species_image_url, v_rarity, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

revoke all on function public.create_pet_listing(uuid, uuid, integer) from public;
grant execute on function public.create_pet_listing(uuid, uuid, integer) to authenticated;

-- ── List an item stack ───────────────────────────────────────────────
create function public.create_item_listing(
  p_seller_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_price_coins integer
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

  if p_price_coins <= 0 then
    raise exception 'Price must be at least 1 coin.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be at least 1.';
  end if;

  select quantity into v_have
  from public.user_inventory
  where user_id = p_seller_id and item_id = p_item_id;

  -- Sanity check only, same caveat as everything else in this file and
  -- in trading: not a reservation. A seller could list more across
  -- several listings than they actually have; buy_listing re-verifies
  -- for real at purchase time.
  if coalesce(v_have, 0) < p_quantity then
    raise exception 'You don''t have that many to list.';
  end if;

  insert into public.marketplace_listings (seller_id, listing_type, price_coins, item_id, item_quantity)
  values (p_seller_id, 'item', p_price_coins, p_item_id, p_quantity)
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

revoke all on function public.create_item_listing(uuid, uuid, integer, integer) from public;
grant execute on function public.create_item_listing(uuid, uuid, integer, integer) to authenticated;

-- ── Cancel a still-active listing you posted ────────────────────────
create function public.cancel_listing(p_user_id uuid, p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.marketplace_listings
  set status = 'cancelled'
  where id = p_listing_id and seller_id = p_user_id and status = 'active';

  if not found then
    raise exception 'Listing not found, already resolved, or not yours to cancel.';
  end if;
end;
$$;

revoke all on function public.cancel_listing(uuid, uuid) from public;
grant execute on function public.cancel_listing(uuid, uuid) to authenticated;

-- ── Buy a listing ────────────────────────────────────────────────────
create function public.buy_listing(p_buyer_id uuid, p_listing_id uuid)
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
  if v_listing.seller_id = p_buyer_id then
    raise exception 'You can''t buy your own listing.';
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

  if v_buyer.coin_balance < v_listing.price_coins then
    raise exception 'You don''t have enough coins for that.';
  end if;

  -- Re-verify the seller can still deliver — time has passed since the
  -- listing was created (or since the last failed purchase attempt), and
  -- nothing about creating a listing reserves the pet/item quantity.
  -- If it's gone, cancel the listing AND return normally rather than
  -- raising: a raised exception aborts the whole function call and
  -- rolls back everything since entry, including the very cancellation
  -- update meant to fix things up — plpgsql has no way to make one
  -- write outlive an exception without a genuinely separate
  -- transaction, which nothing here needs badly enough to justify.
  -- Same non-exception-status pattern respond_to_trade already uses for
  -- "declined" (0015) — the caller checks the returned `status`, not
  -- just whether an error came back.
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

  update public.users set coin_balance = coin_balance - v_listing.price_coins where id = p_buyer_id;
  update public.users set coin_balance = coin_balance + v_listing.price_coins where id = v_listing.seller_id;

  update public.marketplace_listings
  set status = 'sold', buyer_id = p_buyer_id, sold_at = now()
  where id = p_listing_id;

  return jsonb_build_object('status', 'sold', 'price_coins', v_listing.price_coins);
end;
$$;

revoke all on function public.buy_listing(uuid, uuid) from public;
grant execute on function public.buy_listing(uuid, uuid) to authenticated;
