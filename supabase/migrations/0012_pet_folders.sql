-- Pet folders (Flight Rising-style lairs): each pet belongs to at most
-- one folder, or none ("Unsorted" — a virtual bucket, not a real row, so
-- every new user doesn't need a default folder auto-created for them).
create table public.pet_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create index pet_folders_owner_id_idx on public.pet_folders (owner_id);

alter table public.pet_folders enable row level security;

-- Folders hold nothing sensitive (just a name owned by the player), so —
-- unlike pets/expeditions/etc. elsewhere in this app — plain RLS-gated
-- client CRUD is fine here; no security-definer RPC needed for this
-- table, matching how settings/actions.ts writes display_name/bio
-- directly through RLS rather than via an RPC.
create policy "Users can view own pet folders"
  on public.pet_folders for select
  using (auth.uid() = owner_id);

create policy "Users can create own pet folders"
  on public.pet_folders for insert
  with check (auth.uid() = owner_id);

create policy "Users can rename own pet folders"
  on public.pet_folders for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete own pet folders"
  on public.pet_folders for delete
  using (auth.uid() = owner_id);

-- `on delete set null`: deleting a folder returns its pets to Unsorted
-- rather than requiring the app to move them out first.
alter table public.pets
  add column folder_id uuid references public.pet_folders (id) on delete set null;

create index pets_folder_id_idx on public.pets (folder_id);

-- Moving a pet between folders goes through this RPC rather than a
-- client UPDATE policy on pets — pets has never had one (species_id,
-- rarity, etc. must never be client-writable; see 0002), and adding a
-- broad "owner can update own pets" policy just for folder_id would
-- reopen that even though only folder_id should ever change this way.
create function public.move_pet_to_folder(p_user_id uuid, p_pet_id uuid, p_folder_id uuid)
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
  set folder_id = p_folder_id
  where id = p_pet_id and owner_id = p_user_id;

  if not found then
    raise exception 'Pet not found';
  end if;
end;
$$;

revoke all on function public.move_pet_to_folder(uuid, uuid, uuid) from public;
grant execute on function public.move_pet_to_folder(uuid, uuid, uuid) to authenticated;
