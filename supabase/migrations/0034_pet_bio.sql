-- Pet bios (BBCode-supported, same pipeline as users.bio) — shown on the
-- new /pets/[petId] detail page. Same reasoning as custom_name/folder_id/
-- is_for_trade before it: pets has never had a client UPDATE policy
-- (species_id/rarity/owner_id must never be client-writable), so this
-- goes through a narrow RPC that only ever touches bio, same shape as
-- rename_pet() (0013_pet_names.sql).
alter table public.pets
  add column bio text
  check (bio is null or char_length(bio) <= 2000);

comment on column public.pets.bio is
  'Player-written BBCode source, same convention as users.bio — re-rendered fresh via bbcodeToHtml() on every read, no separate rendered column. Null means no bio written yet. Set only through set_pet_bio().';

create function public.set_pet_bio(p_user_id uuid, p_pet_id uuid, p_bio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bio text;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  v_bio := nullif(trim(p_bio), '');
  if v_bio is not null and char_length(v_bio) > 2000 then
    raise exception 'Bio must be 2000 characters or fewer';
  end if;

  update public.pets
  set bio = v_bio
  where id = p_pet_id and owner_id = p_user_id;

  if not found then
    raise exception 'Pet not found';
  end if;
end;
$$;

revoke all on function public.set_pet_bio(uuid, uuid, text) from public;
grant execute on function public.set_pet_bio(uuid, uuid, text) to authenticated;
