"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("users")
    .update({ bio: bio.length > 0 ? bio : null })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your changes. Please try again." };
  }

  revalidatePath("/profile");
  revalidatePath(`/u/${user.id}`);
  redirect("/profile");
}
