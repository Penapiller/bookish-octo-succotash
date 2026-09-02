-- Custom pet names (Chicken Smoothie-style): every pet starts unnamed —
-- custom_name is null by default, not backfilled from species — and the
-- player can set/clear it later. The species name itself is never
-- treated as the pet's "name" in the app; it's shown separately as
-- flavor/breed info.
alter table public.pets
  add column custom_name text
  check (custom_name is null or char_length(custom_name) between 1 and 40);

comment on column public.pets.custom_name is
  'Player-chosen nickname, null by default (unnamed). Set only through rename_pet(); see move_pet_to_folder() in 0012 for why this is an RPC rather than a client UPDATE policy on pets.';

-- Same shape/reasoning as move_pet_to_folder (0012): pets has never had a
-- client UPDATE policy (species_id/rarity/etc. must never be
-- client-writable), so renaming goes through a narrow RPC that only ever
-- touches custom_name rather than a blanket owner-update policy.
create function public.rename_pet(p_user_id uuid, p_pet_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  -- Blank/whitespace-only input clears the name back to unnamed rather
  -- than being rejected — that's how a player "un-names" a pet.
  v_name := nullif(trim(p_name), '');
  if v_name is not null and char_length(v_name) > 40 then
    raise exception 'Name must be 40 characters or fewer';
  end if;

  update public.pets
  set custom_name = v_name
  where id = p_pet_id and owner_id = p_user_id;

  if not found then
    raise exception 'Pet not found';
  end if;
end;
$$;

revoke all on function public.rename_pet(uuid, uuid, text) from public;
grant execute on function public.rename_pet(uuid, uuid, text) to authenticated;
