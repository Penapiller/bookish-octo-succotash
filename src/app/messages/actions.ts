"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

// Shared by both entry points below: resolve (or create) the conversation
// with the other player, then send the browser straight to it — there's
// no separate "compose" step, the thread page's own reply box is where
// the first message actually gets typed.
async function startConversationAndRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  otherUserId: string,
): Promise<{ error: string }> {
  const { data: conversationId, error } = await supabase.rpc("get_or_create_dm_conversation", {
    p_user_id: userId,
    p_other_user_id: otherUserId,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not start that conversation." };
  }

  redirect(`/messages/${conversationId}`);
}

// Used by the "Send DM" button on /u/[id], which already knows the other
// player's id.
export async function startConversationWithUserId(formData: FormData) {
  const { supabase, user } = await requireUser();

  const otherUserId = String(formData.get("user_id") ?? "");
  if (otherUserId.length === 0) return;

  await startConversationAndRedirect(supabase, user.id, otherUserId);
}

export type StartConversationState = { error: string } | null;

// Used by the "New message" box on /messages, which only has a typed
// display name to go on.
export async function startConversationWithName(
  _prevState: StartConversationState,
  formData: FormData,
): Promise<StartConversationState> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("display_name") ?? "").trim();
  if (name.length === 0) {
    return { error: "Type a player's name first." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("display_name", name)
    .maybeSingle();

  if (!profile) {
    return { error: `No player found named "${name}".` };
  }
  if (profile.id === user.id) {
    return { error: "You can't message yourself." };
  }

  return await startConversationAndRedirect(supabase, user.id, profile.id);
}
