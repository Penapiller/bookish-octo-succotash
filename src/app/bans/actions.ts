"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubmitAppealState = { error: string } | null;

// Scoped to dm/sales/forums bans only — appeals' own INSERT policy
// (0031_moderation_overhaul.sql) rejects an account-ban id outright, so
// this never reaches a player who's been signed out by one anyway (they
// couldn't be on this authenticated page to begin with).
export async function submitAppeal(
  _prevState: SubmitAppealState,
  formData: FormData,
): Promise<SubmitAppealState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const banId = String(formData.get("ban_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (banId.length === 0) {
    return { error: "Missing ban." };
  }
  if (reason.length === 0) {
    return { error: "Explain why you're appealing this." };
  }
  if (reason.length > 1000) {
    return { error: "Appeal must be 1000 characters or fewer." };
  }

  const { error } = await supabase.from("appeals").insert({
    ban_id: banId,
    player_id: user.id,
    reason,
  });

  if (error) {
    return { error: "Could not submit your appeal. It may already have one, or this ban type isn't appealable." };
  }

  revalidatePath("/bans");
  return null;
}
