-- Player-to-player trading. A trade is a fixed offer, not a live
-- negotiation thread: the initiator picks pets/items/coins/gems from
-- their OWN collection to offer (plus an optional free-text note saying
-- what they'd like back), addressed to a specific recipient by user id
-- (resolved client-side from their unique display_name — see
-- 0014_unique_display_names.sql). The recipient can decline, or accept
-- by building their own counter-offer from their OWN collection — a
-- player is never shown another player's private den/inventory, so
-- neither side ever picks FROM the other side's collection, only what
-- they're willing to give from their own. Accepting submits the counter
-- and executes the swap in the same step; there's no further
-- back-and-forth in this first version.
create type public.trade_status as enum ('pending', 'completed', 'declined', 'cancelled');
create type public.trade_side as enum ('initiator', 'recipient');

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  status public.trade_status not null default 'pending',
  note text check (note is null or char_length(note) <= 300),
  initiator_coins integer not null default 0 check (initiator_coins >= 0),
  initiator_gems integer not null default 0 check (initiator_gems >= 0),
  recipient_coins integer not null default 0 check (recipient_coins >= 0),
  recipient_gems integer not null default 0 check (recipient_gems >= 0),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  resolved_at timestamptz,
  check (initiator_id <> recipient_id)
);

create index trades_initiator_id_idx on public.trades (initiator_id);
create index trades_recipient_id_idx on public.trades (recipient_id);

comment on table public.trades is
  'A fixed pets/items/currency offer from initiator to recipient. Rows are only ever written by create_trade/respond_to_trade/cancel_trade below, never a plain client write.';
comment on column public.trades.note is
  'Optional free text from the initiator describing what they''d like back — not binding, just shown to the recipient alongside the offer.';

-- Which pets/items are on which side of a trade. Pets keep their trade_id
-- row after the swap executes (a permanent history of what moved), so
-- side is stored explicitly rather than derived from pets.owner_id, which
-- changes the moment the trade completes.
create table public.trade_pets (
  trade_id uuid not null references public.trades (id) on delete cascade,
  side public.trade_side not null,
  pet_id uuid not null references public.pets (id),
  primary key (trade_id, pet_id)
);

create table public.trade_items (
  trade_id uuid not null references public.trades (id) on delete cascade,
  side public.trade_side not null,
  item_id uuid not null references public.items (id),
  quantity integer not null check (quantity > 0),
  primary key (trade_id, side, item_id)
);

alter table public.trades enable row level security;
alter table public.trade_pets enable row level security;
alter table public.trade_items enable row level security;

create policy "Participants can view their trades"
  on public.trades for select
  using (auth.uid() = initiator_id or auth.uid() = recipient_id);

create policy "Participants can view their trade pets"
  on public.trade_pets for select
  using (exists (
    select 1 from public.trades
    where trades.id = trade_pets.trade_id
      and (trades.initiator_id = auth.uid() or trades.recipient_id = auth.uid())
  ));

create policy "Participants can view their trade items"
  on public.trade_items for select
  using (exists (
    select 1 from public.trades
    where trades.id = trade_items.trade_id
      and (trades.initiator_id = auth.uid() or trades.recipient_id = auth.uid())
  ));

-- pets (0002) only ever let an owner see their OWN pets — but a trade
-- participant needs to see a pet's species/rarity/etc. on either side of
-- a trade even when they don't (or no longer) own it: the recipient
-- reviewing a pending offer never owned the initiator's pet, and once a
-- trade completes, whoever GAVE a pet away no longer owns it but should
-- still see it in their own trade history. Additive (RLS SELECT policies
-- are OR'd together), so this only ever widens visibility for pets that
-- passed through a trade the caller was part of — it can't be used to
-- see an arbitrary stranger's den.
create policy "Trade participants can view traded pets"
  on public.pets for select
  using (exists (
    select 1 from public.trade_pets
    join public.trades on trades.id = trade_pets.trade_id
    where trade_pets.pet_id = pets.id
      and (trades.initiator_id = auth.uid() or trades.recipient_id = auth.uid())
  ));

-- No insert/update/delete policies anywhere above: every write goes
-- through one of the three functions below, each re-validating
-- auth.uid() itself (same pattern as expeditions/brewing/pet folders).

-- ── Propose a trade ─────────────────────────────────────────────────────
-- Ownership/balance here are sanity checks at proposal time only — they
-- are NOT a lock or reservation. The same pets/items/currency could be
-- spent, traded away, or offered again in a second trade before this one
-- is responded to; respond_to_trade() re-checks everything from scratch
-- at accept time and fails cleanly (leaving the trade untouched) if the
-- offer is no longer valid. This keeps "propose a trade" cheap and
-- lock-free instead of needing an escrow/reservation system.
create function public.create_trade(
  p_initiator_id uuid,
  p_recipient_id uuid,
  p_pet_ids uuid[],
  p_item_ids uuid[],
  p_item_quantities integer[],
  p_coins integer,
  p_gems integer,
  p_note text
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
begin
  if auth.uid() is distinct from p_initiator_id then
    raise exception 'Not authorized';
  end if;

  if p_recipient_id = p_initiator_id then
    raise exception 'You can''t trade with yourself.';
  end if;

  if not exists (select 1 from public.users where id = p_recipient_id) then
    raise exception 'That player could not be found.';
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

  if coalesce(array_length(p_pet_ids, 1), 0) = 0
     and coalesce(array_length(p_item_ids, 1), 0) = 0
     and p_coins = 0 and p_gems = 0 then
    raise exception 'Offer at least one pet, item, coin, or gem.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'Note must be 300 characters or fewer.';
  end if;

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

  insert into public.trades (initiator_id, recipient_id, note, initiator_coins, initiator_gems)
  values (p_initiator_id, p_recipient_id, v_note, p_coins, p_gems)
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

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, uuid, uuid[], uuid[], integer[], integer, integer, text) from public;
grant execute on function public.create_trade(uuid, uuid, uuid[], uuid[], integer[], integer, integer, text) to authenticated;

-- ── Respond to a trade (decline, or accept with a counter-offer) ────────
create function public.respond_to_trade(
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
  -- comment on create_trade() above for why this wasn't locked/reserved
  -- up front.
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
  -- only — never the initiator's).
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
  set owner_id = v_trade.recipient_id, folder_id = null
  where id in (
    select pet_id from public.trade_pets where trade_id = p_trade_id and side = 'initiator'
  );

  update public.pets
  set owner_id = v_trade.initiator_id, folder_id = null
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

revoke all on function public.respond_to_trade(uuid, uuid, boolean, uuid[], uuid[], integer[], integer, integer) from public;
grant execute on function public.respond_to_trade(uuid, uuid, boolean, uuid[], uuid[], integer[], integer, integer) to authenticated;

-- ── Cancel a still-pending trade you sent ────────────────────────────────
create function public.cancel_trade(p_user_id uuid, p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.trades
  set status = 'cancelled', resolved_at = now()
  where id = p_trade_id and initiator_id = p_user_id and status = 'pending';

  if not found then
    raise exception 'Trade not found, already resolved, or not yours to cancel.';
  end if;
end;
$$;

revoke all on function public.cancel_trade(uuid, uuid) from public;
grant execute on function public.cancel_trade(uuid, uuid) to authenticated;
