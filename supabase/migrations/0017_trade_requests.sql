-- Lets the initiator request specific pets/items/coins/gems from the
-- RECIPIENT'S side too, picked from whatever that player has marked
-- is_for_trade (0016) — this is what makes "browse for-trade pets, then
-- build a trade around what you found" possible, instead of only ever
-- describing what you want in a free-text note. The request is a
-- starting point, not a lock: the recipient reviews it on the trade
-- detail page and can accept it as-is, or swap in something else
-- entirely from their own collection before accepting (respond_to_trade,
-- unchanged in this respect, already lets them submit any pets/items/
-- currency they actually own).

-- create_trade (0015) gains five new trailing parameters, all defaulted
-- so existing callers keep working unchanged. Appending trailing
-- DEFAULT-valued parameters is the one signature change CREATE OR
-- REPLACE allows without dropping the function first.
create or replace function public.create_trade(
  p_initiator_id uuid,
  p_recipient_id uuid,
  p_pet_ids uuid[],
  p_item_ids uuid[],
  p_item_quantities integer[],
  p_coins integer,
  p_gems integer,
  p_note text,
  p_requested_pet_ids uuid[] default '{}',
  p_requested_item_ids uuid[] default '{}',
  p_requested_item_quantities integer[] default '{}',
  p_requested_coins integer default 0,
  p_requested_gems integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade_id uuid;
  v_note text;
  v_coin_balance integer;
  v_gem_balance integer;
  v_recipient_coin_balance integer;
  v_recipient_gem_balance integer;
begin
  if auth.uid() is distinct from p_initiator_id then
    raise exception 'Not authorized';
  end if;

  if p_recipient_id = p_initiator_id then
    raise exception 'You can''t trade with yourself.';
  end if;

  select coin_balance, gem_balance into v_recipient_coin_balance, v_recipient_gem_balance
  from public.users where id = p_recipient_id;

  if not found then
    raise exception 'That player could not be found.';
  end if;

  if p_coins < 0 or p_gems < 0 or p_requested_coins < 0 or p_requested_gems < 0 then
    raise exception 'Coins/gems cannot be negative.';
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) <> coalesce(array_length(p_item_quantities, 1), 0) then
    raise exception 'Mismatched item/quantity counts.';
  end if;
  if coalesce(array_length(p_requested_item_ids, 1), 0) <> coalesce(array_length(p_requested_item_quantities, 1), 0) then
    raise exception 'Mismatched requested item/quantity counts.';
  end if;

  if exists (select 1 from unnest(p_item_quantities) as q(qty) where q.qty <= 0)
     or exists (select 1 from unnest(p_requested_item_quantities) as q(qty) where q.qty <= 0)
  then
    raise exception 'Item quantities must be positive.';
  end if;

  if coalesce(array_length(p_pet_ids, 1), 0) = 0
     and coalesce(array_length(p_item_ids, 1), 0) = 0
     and p_coins = 0 and p_gems = 0
  then
    raise exception 'Offer at least one pet, item, coin, or gem.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'Note must be 300 characters or fewer.';
  end if;

  -- ── What you're offering (unchanged from 0015) ─────────────────────────
  if coalesce(array_length(p_pet_ids, 1), 0) > 0
     and (select count(*) from public.pets where id = any(p_pet_ids) and owner_id = p_initiator_id)
         <> array_length(p_pet_ids, 1)
  then
    raise exception 'One or more of those pets could not be found.';
  end if;

  select coin_balance, gem_balance into v_coin_balance, v_gem_balance
  from public.users where id = p_initiator_id;

  if v_coin_balance < p_coins or v_gem_balance < p_gems then
    raise exception 'You don''t have that many coins/gems to offer.';
  end if;

  if exists (
    with pairs as (
      select item_id, qty from unnest(p_item_ids, p_item_quantities) as t(item_id, qty)
    ), agg as (
      select item_id, sum(qty)::integer as qty from pairs group by item_id
    )
    select 1 from agg a
    left join public.user_inventory ui on ui.user_id = p_initiator_id and ui.item_id = a.item_id
    where coalesce(ui.quantity, 0) < a.qty
  ) then
    raise exception 'You don''t have that many of one or more offered items.';
  end if;

  -- ── What you're requesting from them — must be something they've
  -- actually marked is_for_trade, same sanity-check-only caveat as the
  -- rest of this table (see the comment on the original create_trade in
  -- 0015: nothing here is locked/reserved, respond_to_trade re-validates
  -- everything from scratch when they respond). ───────────────────────
  if coalesce(array_length(p_requested_pet_ids, 1), 0) > 0
     and (
       select count(*) from public.pets
       where id = any(p_requested_pet_ids) and owner_id = p_recipient_id and is_for_trade = true
     ) <> array_length(p_requested_pet_ids, 1)
  then
    raise exception 'One or more of those pets are not available to trade.';
  end if;

  if v_recipient_coin_balance < p_requested_coins or v_recipient_gem_balance < p_requested_gems then
    raise exception 'They don''t have that many coins/gems.';
  end if;

  if exists (
    with pairs as (
      select item_id, qty from unnest(p_requested_item_ids, p_requested_item_quantities) as t(item_id, qty)
    ), agg as (
      select item_id, sum(qty)::integer as qty from pairs group by item_id
    )
    select 1 from agg a
    left join public.user_inventory ui
      on ui.user_id = p_recipient_id and ui.item_id = a.item_id and ui.is_for_trade = true
    where coalesce(ui.quantity, 0) < a.qty
  ) then
    raise exception 'One or more of those items are not available to trade in that quantity.';
  end if;

  insert into public.trades (
    initiator_id, recipient_id, note,
    initiator_coins, initiator_gems,
    recipient_coins, recipient_gems
  )
  values (
    p_initiator_id, p_recipient_id, v_note,
    p_coins, p_gems,
    p_requested_coins, p_requested_gems
  )
  returning id into v_trade_id;

  if coalesce(array_length(p_pet_ids, 1), 0) > 0 then
    insert into public.trade_pets (trade_id, side, pet_id)
    select v_trade_id, 'initiator', pet_id from unnest(p_pet_ids) as pet_id;
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) > 0 then
    insert into public.trade_items (trade_id, side, item_id, quantity)
    select v_trade_id, 'initiator', item_id, sum(qty)::integer
    from unnest(p_item_ids, p_item_quantities) as t(item_id, qty)
    group by item_id;
  end if;

  if coalesce(array_length(p_requested_pet_ids, 1), 0) > 0 then
    insert into public.trade_pets (trade_id, side, pet_id)
    select v_trade_id, 'recipient', pet_id from unnest(p_requested_pet_ids) as pet_id;
  end if;

  if coalesce(array_length(p_requested_item_ids, 1), 0) > 0 then
    insert into public.trade_items (trade_id, side, item_id, quantity)
    select v_trade_id, 'recipient', item_id, sum(qty)::integer
    from unnest(p_requested_item_ids, p_requested_item_quantities) as t(item_id, qty)
    group by item_id;
  end if;

  return v_trade_id;
end;
$$;

-- respond_to_trade (0015) — same signature, only the body changes: it
-- previously INSERTed the recipient's submitted pets/items directly,
-- which would conflict with any 'recipient'-side rows create_trade just
-- pre-filled as the request (same trade_id/pet_id or trade_id/side/
-- item_id primary key). Delete whatever was requested before inserting
-- what the recipient actually chose to give — which may just be the
-- request confirmed as-is, or something they swapped in instead.
create or replace function public.respond_to_trade(
  p_user_id uuid,
  p_trade_id uuid,
  p_accept boolean,
  p_pet_ids uuid[] default '{}',
  p_item_ids uuid[] default '{}',
  p_item_quantities integer[] default '{}',
  p_coins integer default 0,
  p_gems integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade record;
  v_initiator record;
  v_recipient record;
  v_item record;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;

  if not found then
    raise exception 'Trade not found.';
  end if;
  if v_trade.recipient_id <> p_user_id then
    raise exception 'Not authorized';
  end if;
  if v_trade.status <> 'pending' then
    raise exception 'This trade has already been resolved.';
  end if;

  if not p_accept then
    update public.trades
    set status = 'declined', responded_at = now(), resolved_at = now()
    where id = p_trade_id;

    return jsonb_build_object('status', 'declined');
  end if;

  if p_coins < 0 or p_gems < 0 then
    raise exception 'Coins/gems cannot be negative.';
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) <> coalesce(array_length(p_item_quantities, 1), 0) then
    raise exception 'Mismatched item/quantity counts.';
  end if;

  if exists (select 1 from unnest(p_item_quantities) as q(qty) where q.qty <= 0) then
    raise exception 'Item quantities must be positive.';
  end if;

  -- Lock both accounts in a consistent order (by id) so two trades
  -- between the same pair of players can never deadlock against each
  -- other.
  if v_trade.initiator_id < v_trade.recipient_id then
    select * into v_initiator from public.users where id = v_trade.initiator_id for update;
    select * into v_recipient from public.users where id = v_trade.recipient_id for update;
  else
    select * into v_recipient from public.users where id = v_trade.recipient_id for update;
    select * into v_initiator from public.users where id = v_trade.initiator_id for update;
  end if;

  -- Re-verify the initiator's original offer is STILL valid — see the
  -- comment on create_trade() in 0015 for why this wasn't locked/
  -- reserved up front.
  if exists (
    select 1 from public.trade_pets tp
    left join public.pets p on p.id = tp.pet_id and p.owner_id = v_trade.initiator_id
    where tp.trade_id = p_trade_id and tp.side = 'initiator' and p.id is null
  ) then
    raise exception 'This trade is no longer valid — the offer has changed.';
  end if;

  if exists (
    select 1 from public.trade_items ti
    left join public.user_inventory ui
      on ui.user_id = v_trade.initiator_id and ui.item_id = ti.item_id
    where ti.trade_id = p_trade_id and ti.side = 'initiator'
      and coalesce(ui.quantity, 0) < ti.quantity
  ) then
    raise exception 'This trade is no longer valid — the offer has changed.';
  end if;

  if v_initiator.coin_balance < v_trade.initiator_coins or v_initiator.gem_balance < v_trade.initiator_gems then
    raise exception 'This trade is no longer valid — the offer has changed.';
  end if;

  -- Validate the recipient's own counter-offer (their own collection
  -- only — never the initiator's). This may just be re-confirming what
  -- was requested, or something else entirely; either way it's validated
  -- fresh here, same as any other trade response.
  if coalesce(array_length(p_pet_ids, 1), 0) > 0
     and (select count(*) from public.pets where id = any(p_pet_ids) and owner_id = p_user_id)
         <> array_length(p_pet_ids, 1)
  then
    raise exception 'One or more of your pets could not be found.';
  end if;

  if v_recipient.coin_balance < p_coins or v_recipient.gem_balance < p_gems then
    raise exception 'You don''t have that many coins/gems to give.';
  end if;

  if exists (
    with pairs as (
      select item_id, qty from unnest(p_item_ids, p_item_quantities) as t(item_id, qty)
    ), agg as (
      select item_id, sum(qty)::integer as qty from pairs group by item_id
    )
    select 1 from agg a
    left join public.user_inventory ui on ui.user_id = p_user_id and ui.item_id = a.item_id
    where coalesce(ui.quantity, 0) < a.qty
  ) then
    raise exception 'You don''t have that many of one or more of those items.';
  end if;

  update public.trades
  set recipient_coins = p_coins,
      recipient_gems = p_gems,
      status = 'completed',
      responded_at = now(),
      resolved_at = now()
  where id = p_trade_id;

  -- Clear out whatever create_trade pre-filled as the request before
  -- recording what the recipient actually chose to give — otherwise
  -- re-confirming the same pets/items the request already named would
  -- hit this table's primary key.
  delete from public.trade_pets where trade_id = p_trade_id and side = 'recipient';
  delete from public.trade_items where trade_id = p_trade_id and side = 'recipient';

  if coalesce(array_length(p_pet_ids, 1), 0) > 0 then
    insert into public.trade_pets (trade_id, side, pet_id)
    select p_trade_id, 'recipient', pet_id from unnest(p_pet_ids) as pet_id;
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) > 0 then
    insert into public.trade_items (trade_id, side, item_id, quantity)
    select p_trade_id, 'recipient', item_id, sum(qty)::integer
    from unnest(p_item_ids, p_item_quantities) as t(item_id, qty)
    group by item_id;
  end if;

  -- ── Execute the swap ──────────────────────────────────────────────────
  update public.pets
  set owner_id = v_trade.recipient_id, folder_id = null, is_for_trade = false
  where id in (
    select pet_id from public.trade_pets where trade_id = p_trade_id and side = 'initiator'
  );

  update public.pets
  set owner_id = v_trade.initiator_id, folder_id = null, is_for_trade = false
  where id in (
    select pet_id from public.trade_pets where trade_id = p_trade_id and side = 'recipient'
  );

  for v_item in
    select item_id, quantity from public.trade_items
    where trade_id = p_trade_id and side = 'initiator'
  loop
    update public.user_inventory
    set quantity = quantity - v_item.quantity
    where user_id = v_trade.initiator_id and item_id = v_item.item_id;

    insert into public.user_inventory (user_id, item_id, quantity)
    values (v_trade.recipient_id, v_item.item_id, v_item.quantity)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + v_item.quantity;
  end loop;

  for v_item in
    select item_id, quantity from public.trade_items
    where trade_id = p_trade_id and side = 'recipient'
  loop
    update public.user_inventory
    set quantity = quantity - v_item.quantity
    where user_id = v_trade.recipient_id and item_id = v_item.item_id;

    insert into public.user_inventory (user_id, item_id, quantity)
    values (v_trade.initiator_id, v_item.item_id, v_item.quantity)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + v_item.quantity;
  end loop;

  perform public.begin_trusted_user_write();

  update public.users
  set coin_balance = coin_balance - v_trade.initiator_coins + p_coins,
      gem_balance = gem_balance - v_trade.initiator_gems + p_gems
  where id = v_trade.initiator_id;

  update public.users
  set coin_balance = coin_balance - p_coins + v_trade.initiator_coins,
      gem_balance = gem_balance - p_gems + v_trade.initiator_gems
  where id = v_trade.recipient_id;

  return jsonb_build_object('status', 'completed');
end;
$$;
