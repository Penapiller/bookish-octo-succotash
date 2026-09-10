-- A makeshift NPC shop: any item can be marked for sale by giving it a
-- shop_price (admin-set, on the same item edit form as sell_value) — no
-- new "shop item" table, just one nullable column on the existing items
-- catalog, plus one RPC to buy it. Only the two seed items are priced by
-- this migration's own seed data (the ask was "a shop to buy seeds"), but
-- nothing here is seed-specific: an admin can give any other item (a
-- fertilizer, an ingredient) a shop_price later with no code changes.

alter table public.items
  add column shop_price integer check (shop_price is null or shop_price >= 0);

comment on column public.items.shop_price is
  'Coin price in the NPC shop (/shop). Null means not for sale there — distinct from sell_value, which is what selling this item back would be worth (not yet wired to any action).';

create function public.buy_shop_item(p_user_id uuid, p_item_id uuid, p_quantity integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_is_active boolean;
  v_coin_balance integer;
  v_total_cost integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_quantity < 1 then
    raise exception 'Quantity must be at least 1.';
  end if;

  select shop_price, is_active into v_price, v_is_active
  from public.items
  where id = p_item_id;

  if not found or not v_is_active then
    raise exception 'Item not found.';
  end if;

  if v_price is null then
    raise exception 'This item isn''t for sale.';
  end if;

  v_total_cost := v_price * p_quantity;

  select coin_balance into v_coin_balance
  from public.users
  where id = p_user_id
  for update;

  if v_coin_balance < v_total_cost then
    raise exception 'Not enough coins: this costs % coins, you have %', v_total_cost, v_coin_balance;
  end if;

  perform public.begin_trusted_user_write();
  update public.users set coin_balance = coin_balance - v_total_cost where id = p_user_id;

  insert into public.user_inventory (user_id, item_id, quantity)
  values (p_user_id, p_item_id, p_quantity)
  on conflict (user_id, item_id) do update
    set quantity = public.user_inventory.quantity + p_quantity;

  return jsonb_build_object(
    'item_id', p_item_id,
    'quantity', p_quantity,
    'total_cost', v_total_cost,
    'new_coin_balance', v_coin_balance - v_total_cost
  );
end;
$$;

revoke all on function public.buy_shop_item(uuid, uuid, integer) from public;
grant execute on function public.buy_shop_item(uuid, uuid, integer) to authenticated;

-- ── Seed data: price the two seed items from 0035 ───────────────────
update public.items set shop_price = 15 where id = '00000000-0000-0000-0000-000000000801'; -- Carrot Seed
update public.items set shop_price = 40 where id = '00000000-0000-0000-0000-000000000802'; -- Wildflower Seed Packet
