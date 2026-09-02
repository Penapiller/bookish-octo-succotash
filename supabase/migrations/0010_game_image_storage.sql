-- A Supabase Storage bucket admins can upload item/species artwork to,
-- replacing the placehold.co placeholder URLs used during early testing.
-- next.config.ts already allowlists *.supabase.co/storage/v1/object/**
-- for next/image, anticipating this.
--
-- Public bucket (art needs to be readable by every player, not just
-- admins) with admin-gated writes — same current_user_is_admin() RLS
-- pattern as every other admin-managed table in 0009_admin_panel.sql.
-- storage.objects already has RLS enabled by default on every Supabase
-- project; these policies just add to it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-images',
  'game-images',
  true,
  5242880, -- 5 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Anyone can view game images"
  on storage.objects for select
  using (bucket_id = 'game-images');

create policy "Admins can upload game images"
  on storage.objects for insert
  with check (bucket_id = 'game-images' and public.current_user_is_admin());

-- Uploads use upsert (re-uploading for the same item/species overwrites
-- its one file at a stable path) rather than versioned filenames, so an
-- UPDATE policy is needed alongside INSERT.
create policy "Admins can replace game images"
  on storage.objects for update
  using (bucket_id = 'game-images' and public.current_user_is_admin())
  with check (bucket_id = 'game-images' and public.current_user_is_admin());

create policy "Admins can delete game images"
  on storage.objects for delete
  using (bucket_id = 'game-images' and public.current_user_is_admin());
