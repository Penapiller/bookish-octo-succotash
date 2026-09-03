import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Uploads a player's own profile picture to the avatars bucket (see
 * 0025_player_avatars.sql) at a stable, per-user path — RLS only lets a
 * user write into their own {user_id}/ folder — always upsert:true so
 * re-uploading overwrites the one file rather than accumulating orphans.
 * Returns the new public URL (with a cache-busting query param, since the
 * path itself doesn't change on re-upload) or null if no file was given.
 */
export async function uploadAvatar(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  if (!extension) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}. Use PNG, JPEG, WebP, or GIF.`);
  }

  const path = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  return `${publicUrl}?v=${Date.now()}`;
}

/**
 * Deletes whatever's in the player's avatar folder. The extension isn't
 * known at removal time (upload() can land png/jpg/webp/gif), so this
 * lists the {user_id}/ folder rather than guessing a single path.
 */
export async function deleteAvatarFiles(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data: files } = await supabase.storage.from("avatars").list(userId);
  if (!files || files.length === 0) return;

  await supabase.storage.from("avatars").remove(files.map((file) => `${userId}/${file.name}`));
}
