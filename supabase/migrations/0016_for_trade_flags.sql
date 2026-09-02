-- "For trade" flags (Chicken Smoothie-style): a player marks individual
-- pets/item stacks as available to trade, and any signed-in player can
-- then browse everyone's for-trade pets/items — this is what makes it
-- possible to build a trade request against someone you've never talked
-- to, instead of only ever trading blind with a free-text note.
--
-- Marking something for_trade does NOT restrict what it can be offered
-- in an actual trade proposal later — a player can still offer anything
-- they own once a trade is already underway (see 0015). The flag only
-- gates *discovery*: what shows up when browsing, and what an initiator
-- who isn't already a trade partner is allowed to request from someone
-- else's collection (see 0017).
alter table public.pets add column is_for_trade boolean not null default false;
alter table public.user_inventory add column is_for_trade boolean not null default false;

create index pets_for_trade_idx on public.pets (is_for_trade) where is_for_trade;
create index user_inventory_for_trade_idx on public.user_inventory (is_for_trade) where is_for_trade;

comment on column public.pets.is_for_trade is
  'Owner has marked this pet as available to trade — visible to every signed-in player via the for-trade browse RLS policy below, not just the owner.';
comment on column public.user_inventory.is_for_trade is
  'Owner has marked this item stack as available to trade. Same visibility rule as pets.is_for_trade.';

-- ── Browse visibility ────────────────────────────────────────────────────
-- Additive SELECT policies (OR'd with the owner-only ones from 0002/0005)
-- — a for-trade pet/item becomes visible to every signed-in player, but
-- nothing else about someone's den/inventory does.
create policy "For-trade pets are viewable by everyone"
  on public.pets for select
  to authenticated
  using (is_for_trade = true);

create policy "For-trade items are viewable by everyone"
  on public.user_inventory for select
  to authenticated
  using (is_for_trade = true and quantity > 0);

-- ── Toggling the flag ────────────────────────────────────────────────────
-- pets/user_inventory have never had a client UPDATE policy (species_id,
-- quantity, etc. must never be directly client-writable — see 0002/0005),
-- so this goes through narrow RPCs the same way custom_name/folder_id do,
-- rather than opening a broader owner-update policy just for this one
-- column.
create function public.set_pet_for_trade(p_user_id uuid, p_pet_id uuid, p_is_for_trade boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.pets
  set is_for_trade = p_is_for_trade
  where id = p_pet_id and owner_id = p_user_id;

  if not found then
    raise exception 'Pet not found';
  end if;
end;
$$;

revoke all on function public.set_pet_for_trade(uuid, uuid, boolean) from public;
grant execute on function public.set_pet_for_trade(uuid, uuid, boolean) to authenticated;

create function public.set_item_for_trade(p_user_id uuid, p_item_id uuid, p_is_for_trade boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.user_inventory
  set is_for_trade = p_is_for_trade
  where user_id = p_user_id and item_id = p_item_id;

  if not found then
    raise exception 'You don''t have that item.';
  end if;
end;
$$;

revoke all on function public.set_item_for_trade(uuid, uuid, boolean) from public;
grant execute on function public.set_item_for_trade(uuid, uuid, boolean) to authenticated;

-- Bulk convenience matching the "pet groups that are for trade" framing:
-- mark every pet in one folder (or Unsorted, when p_folder_id is null) at
-- once instead of toggling pets one at a time. Same ownership check as
-- move_pet_to_folder (0012).
create function public.set_folder_pets_for_trade(
  p_user_id uuid,
  p_folder_id uuid,
  p_is_for_trade boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_folder_id is not null and not exists (
    select 1 from public.pet_folders where id = p_folder_id and owner_id = p_user_id
  ) then
    raise exception 'Folder not found';
  end if;

  update public.pets
  set is_for_trade = p_is_for_trade
  where owner_id = p_user_id
    and folder_id is not distinct from p_folder_id;
end;
$$;

revoke all on function public.set_folder_pets_for_trade(uuid, uuid, boolean) from public;
grant execute on function public.set_folder_pets_for_trade(uuid, uuid, boolean) to authenticated;
