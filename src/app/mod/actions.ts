"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/lib/moderation";
import type { BanType, ReportStatus } from "@/lib/supabase/types";

const BAN_TYPES: BanType[] = ["dm", "sales", "forums", "account"];

// Plain form actions (no useActionState, no redirect) — same "just does
// the thing, no confirmation step" convention as other staff-only writes
// in this app (deleteFolder, updateThreadFlags). requireModerator() here
// is defense in depth: the button is only rendered inside /mod (already
// gated by its own layout), and reports' staff-only UPDATE RLS policy
// (0027_moderation.sql) is the real backstop either way.

export async function resolveReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  if (reportId.length === 0 || (status !== "resolved" && status !== "dismissed")) return;

  const noteRaw = formData.get("resolution_note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";

  await supabase
    .from("reports")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: note.length > 0 ? note : null,
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
}

export type SendWarningState = { error: string } | null;

// Always sent from the Staff pseudo-account (send_staff_message RPC,
// 0029_bans_and_staff_fixes.sql) — NEVER the acting moderator's own
// account. Deliberate mod anonymity: a player who gets warned should
// never be able to tell which specific moderator handled their case, only
// that staff did, so they can't target that mod over a decision the team
// made collectively. A canned message or a custom one both go through
// here identically.
export async function sendStaffWarning(
  _prevState: SendWarningState,
  formData: FormData,
): Promise<SendWarningState> {
  const { supabase } = await requireModerator();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }
  if (message.length === 0) {
    return { error: "Pick a canned message or write your own first." };
  }
  if (message.length > 4000) {
    return { error: "Message must be 4000 characters or fewer." };
  }

  const { data: conversationId, error } = await supabase.rpc("send_staff_message", {
    p_target_user_id: targetUserId,
    p_body: message,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not send that message. Please try again." };
  }

  redirect(`/messages/${conversationId}`);
}

export type QuickQuoteState = { error: string } | null;

// The "quick quote" tool from a report card — for a board/DM content
// violation specifically, quotes the offending text back to the player
// alongside a rule-violation notice, in one step instead of a moderator
// copy-pasting the quote into the warning-DM form by hand. Same anonymous
// Staff-account delivery as sendStaffWarning above — quoting content back
// at someone is exactly the kind of message where a targeted player would
// most want to know who sent it, so this can't be an exception to mod
// anonymity.
export async function sendQuickQuote(
  _prevState: QuickQuoteState,
  formData: FormData,
): Promise<QuickQuoteState> {
  const { supabase } = await requireModerator();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  const quotedContent = String(formData.get("quoted_content") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }
  if (quotedContent.length === 0) {
    return { error: "Nothing to quote." };
  }
  if (note.length === 0) {
    return { error: "Add a short note about which rule this violated." };
  }

  const body = `The following content you posted violates our community guidelines:\n\n"${quotedContent}"\n\n${note}`;
  if (body.length > 4000) {
    return { error: "That quote plus your note is too long (4000 character limit)." };
  }

  const { data: conversationId, error } = await supabase.rpc("send_staff_message", {
    p_target_user_id: targetUserId,
    p_body: body,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not send that message. Please try again." };
  }

  redirect(`/messages/${conversationId}`);
}

// Deletes the reported post AND resolves the report in one step — the
// same underlying delete as forums/actions.ts's deletePost, just entered
// from the queue's workflow instead of the thread view, so it also closes
// out the report rather than leaving it pointing at a post that no longer
// exists.
export async function deleteReportedPost(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (reportId.length === 0 || postId.length === 0) return;

  await supabase.from("forum_posts").delete().eq("id", postId);
  await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: "Post deleted.",
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
}

export type IssueBanState = { error: string } | null;

// Time-based (staff always choose a duration, no permanent-ban option —
// see 0029_bans_and_staff_fixes.sql's `expires_at not null` and the "check
// (expires_at > issued_at)" constraint). Account bans are admin-only to
// issue; a moderator picking "account" here still gets a friendly message
// instead of a raw RLS error, since bans' INSERT policy is the real gate.
export async function issueBan(
  _prevState: IssueBanState,
  formData: FormData,
): Promise<IssueBanState> {
  const { supabase, user } = await requireModerator();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  const banType = String(formData.get("ban_type") ?? "") as BanType;
  const durationHours = Number(formData.get("duration_hours") ?? "");
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";

  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }
  if (!BAN_TYPES.includes(banType)) {
    return { error: "Invalid ban type." };
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return { error: "Pick a duration." };
  }
  if (reason.length > 500) {
    return { error: "Reason must be 500 characters or fewer." };
  }

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("bans").insert({
    user_id: targetUserId,
    ban_type: banType,
    reason: reason.length > 0 ? reason : null,
    issued_by: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    return {
      error:
        banType === "account"
          ? "Only admins can issue account bans."
          : `Could not issue ban: ${error.message}`,
    };
  }

  revalidatePath(`/mod/players/${targetUserId}`);
  return null;
}

// Ends a ban early. Plain form action (same "just does the thing"
// convention as resolveReport/deleteReportedPost above) — the update
// policy's own ban-type/role check is the real gate on WHO can lift
// WHICH ban, so an unauthorized attempt just quietly updates 0 rows.
export async function liftBan(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const banId = String(formData.get("ban_id") ?? "");
  const targetUserId = String(formData.get("target_user_id") ?? "");
  if (banId.length === 0) return;

  await supabase
    .from("bans")
    .update({ lifted_at: new Date().toISOString(), lifted_by: user.id })
    .eq("id", banId);

  if (targetUserId.length > 0) {
    revalidatePath(`/mod/players/${targetUserId}`);
  }
}
