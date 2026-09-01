"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_BIO_LENGTH = 500;

export type SettingsFormState = { error: string } | null;

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

  const displayNameRaw = formData.get("display_name");
  const bioRaw = formData.get("bio");

  const displayName =
    typeof displayNameRaw === "string" ? displayNameRaw.trim() : "";
  const bio = typeof bioRaw === "string" ? bioRaw.trim() : "";

  if (displayName.length === 0) {
    return { error: "Display name can't be empty." };
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
    };
  }
  if (bio.length > MAX_BIO_LENGTH) {
    return { error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer.` };
  }

  // Only display_name and bio are ever written here — currency_balance,
  // den_size, is_admin, google_sub, and email are never taken from client
  // input. The DB trigger also enforces this server-side as a second layer.
  const { error } = await supabase
    .from("users")
    .update({ display_name: displayName, bio: bio.length > 0 ? bio : null })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your changes. Please try again." };
  }

  revalidatePath("/profile");
  revalidatePath(`/u/${user.id}`);
  redirect("/profile");
}
