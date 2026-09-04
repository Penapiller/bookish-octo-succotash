"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SendMessageState = { error: string } | null;

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const conversationId = String(formData.get("conversation_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (body.length === 0) {
    return { error: "Type a message first." };
  }
  if (body.length > 4000) {
    return { error: "Messages must be 4000 characters or fewer." };
  }

  const { error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body });

  if (error) {
    return { error: "Could not send that message. Please try again." };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return null;
}
