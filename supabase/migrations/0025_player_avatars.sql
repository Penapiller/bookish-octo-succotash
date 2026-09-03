-- Player-uploaded profile pictures, replacing the old behavior of
-- importing the player's Google account photo on signup.
--
-- New players now start with no avatar_url at all (handle_new_user() no
-- longer reads raw_user_meta_data ->> 'avatar_url'/'picture'); every page
-- that renders an avatar already falls back to a placeholder circle when
-- avatar_url is null (see site-header.tsx, /profile, /u/[id]), so this is
-- a pure removal — no new fallback UI needed here. Players can upload
-- their own picture later from /settings.
--
-- Storage bucket + RLS follow the same public-bucket-with-gated-writes
-- shape as game-images (0010_game_image_storage.sql), except writes are
-- gated by "this is your own folder" (auth.uid() = the first path
-- segment) instead of admin-only, since every player manages their own
-- avatar. Path convention: avatars/{user_id}/avatar.{ext} — the fixed
-- filename plus upsert:true (see the upload helper) means re-uploading
-- replaces the one file instead of accumulating orphans.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, google_sub, email, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'),
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
