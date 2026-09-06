"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type CannedMessageFormState = { error: string } | null;

function readCannedMessageFields(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const sortOrderRaw = String(formData.get("sort_order") ?? "0");
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (label.length === 0) return { ok: false as const, error: "Label can't be empty." };
  if (label.length > 100) return { ok: false as const, error: "Label must be 100 characters or fewer." };
  if (body.length === 0) return { ok: false as const, error: "Message body can't be empty." };
  if (body.length > 4000) return { ok: false as const, error: "Message body must be 4000 characters or fewer." };

  return {
    ok: true as const,
    fields: {
      label,
      body,
      is_active: isActive,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  };
}

export async function createCannedMessage(
  _prevState: CannedMessageFormState,
  formData: FormData,
): Promise<CannedMessageFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readCannedMessageFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("canned_staff_messages").insert(parsed.fields);
  if (error) {
    return { error: `Could not create message: ${error.message}` };
  }

  revalidatePath("/admin/canned-messages");
  redirect("/admin/canned-messages");
}

export async function updateCannedMessage(
  _prevState: CannedMessageFormState,
  formData: FormData,
): Promise<CannedMessageFormState> {
  const { supabase } = await requireAdmin();

  const messageId = String(formData.get("message_id") ?? "");
  if (messageId.length === 0) return { error: "Missing message id." };

  const parsed = readCannedMessageFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("canned_staff_messages").update(parsed.fields).eq("id", messageId);
  if (error) {
    return { error: `Could not save message: ${error.message}` };
  }

  revalidatePath("/admin/canned-messages");
  redirect("/admin/canned-messages");
}
