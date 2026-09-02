"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_BIO_LENGTH = 500;

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
