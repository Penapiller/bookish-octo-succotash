"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadAvatar, deleteAvatarFiles } from "@/lib/avatar-upload";

// Keep in sync with MAX_BIO_LENGTH in ./settings-form.tsx.
const MAX_BIO_LENGTH = 2000;

export type SettingsFormState = { error: string } | null;

// display_name is deliberately NOT handled here — it's unique and
// rate-limited (see 0014_unique_display_names.sql) and can only be
// changed through the change_display_name() RPC, called directly from
// DisplayNameEditor. The trigger that protects display_name would just
// silently ignore a plain update like this one anyway.
export async function updateProfile(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // `users.bio` stores raw BBCode source, same as forum_posts.body_raw —
  // unlike forum posts there's no separate rendered column here, since a
  // profile page only ever needs to render one bio at a time (not a page
  // of them), so bbcodeToHtml() just runs fresh on every read instead
  // (see /profile and /u/[id]). No sanitization happens at write time;
  // it's exactly as safe either way, since bbcodeToHtml() is the only
  // thing that's ever allowed to turn it into HTML.
  const bioRaw = formData.get("bio");
  const bio = typeof bioRaw === "string" ? bioRaw.trim() : "";

  if (bio.length > MAX_BIO_LENGTH) {
    return { error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer.` };
  }

  // avatarUrl stays undefined (column untouched) when no file was picked —
  // only set when a new upload actually succeeds, so submitting the bio
  // form without touching the file input never clears an existing avatar.
  let avatarUrl: string | undefined;
  const avatarFile = formData.get("avatar");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      avatarUrl = (await uploadAvatar(supabase, user.id, avatarFile)) ?? undefined;
    } catch (uploadError) {
      return {
        error: uploadError instanceof Error ? uploadError.message : "Could not upload avatar.",
      };
    }
  }

  const { error } = await supabase
    .from("users")
    .update({
      bio: bio.length > 0 ? bio : null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your changes. Please try again." };
  }

  revalidatePath("/profile");
  revalidatePath(`/u/${user.id}`);
  redirect("/profile");
}

// Plain form action (no useActionState) — matches the "Remove" buttons
// elsewhere in this app (pet folders, zone pool entries): no confirmation
// step or error display, it just does the thing.
export async function removeAvatar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await deleteAvatarFiles(supabase, user.id);
  await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/settings");
}
