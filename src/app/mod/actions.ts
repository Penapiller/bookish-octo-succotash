"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/lib/moderation";
import type { BanType, ReportStatus, ReportTargetType } from "@/lib/supabase/types";

const BAN_TYPES: BanType[] = ["dm", "sales", "forums", "account"];

// Plain form actions (no useActionState, no redirect) — same "just does
// the thing, no confirmation step" convention as other staff-only writes
// in this app (deleteFolder, updateThreadFlags). requireModerator() here
// is defense in depth: the button is only rendered inside /mod (already
// gated by its own layout), and reports' staff-only UPDATE RLS policy
// (0027_moderation.sql) is the real backstop either way.

type Supa = Awaited<ReturnType<typeof requireModerator>>["supabase"];

type TargetIdentity = {
  target_type: ReportTargetType;
  target_user_id: string | null;
  target_post_id: string | null;
  target_message_id: string | null;
};

async function getReportTargetIdentity(supabase: Supa, reportId: string): Promise<TargetIdentity | null> {
  const { data } = await supabase
    .from("reports")
    .select("target_type, target_user_id, target_post_id, target_message_id")
    .eq("id", reportId)
    .maybeSingle();
  return data;
}

// Every OPEN report sharing a ticket with `reportId` — same target
// identity (same reported post/message/user) — so claim/resolve/dismiss
// can bulk-apply across every duplicate report on that ticket instead of
// a mod having to click through them one at a time (see
// groupReportsByTarget(), mod/resolve-reports.ts, for the matching
// grouping logic used to render the queue). Falls back to just
// `[reportId]` when the live target id has gone null (content deleted
// outside the reports flow, e.g. a direct forum delete) — matching on a
// null id column would otherwise silently sweep in every OTHER
// deleted-content report too.
async function findOpenTicketReportIds(
  supabase: Supa,
  reportId: string,
): Promise<{ ids: string[]; identity: TargetIdentity } | null> {
  const identity = await getReportTargetIdentity(supabase, reportId);
  if (!identity) return null;

  let query = supabase.from("reports").select("id").eq("status", "open").eq("target_type", identity.target_type);
  if (identity.target_type === "user" && identity.target_user_id) {
    query = query.eq("target_user_id", identity.target_user_id);
  } else if (identity.target_type === "forum_post" && identity.target_post_id) {
    query = query.eq("target_post_id", identity.target_post_id);
  } else if (identity.target_type === "dm_message" && identity.target_message_id) {
    query = query.eq("target_message_id", identity.target_message_id);
  } else {
    return { ids: [reportId], identity };
  }

  const { data } = await query;
  const ids = (data ?? []).map((r) => r.id);
  return { ids: ids.length > 0 ? ids : [reportId], identity };
}

export async function resolveReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  if (reportId.length === 0 || (status !== "resolved" && status !== "dismissed")) return;

  const noteRaw = formData.get("resolution_note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";

  const ticket = await findOpenTicketReportIds(supabase, reportId);
  if (!ticket) return;

  await supabase
    .from("reports")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: note.length > 0 ? note : null,
    })
    .in("id", ticket.ids);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  revalidatePath(`/mod/reports/${reportId}`);
}

// Marks every open report on this ticket as being actively worked by the
// claiming mod, so a second mod opening the queue sees it's already
// spoken for instead of duplicating the investigation. Any staff member
// can claim or unclaim any ticket (no "only the claimant can release it"
// restriction) — see 0030_report_tickets.sql.
export async function claimReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  if (reportId.length === 0) return;

  const ticket = await findOpenTicketReportIds(supabase, reportId);
  if (!ticket) return;

  await supabase
    .from("reports")
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .in("id", ticket.ids);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  revalidatePath(`/mod/reports/${reportId}`);
}

export async function unclaimReport(formData: FormData): Promise<void> {
  const { supabase } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  if (reportId.length === 0) return;

  const ticket = await findOpenTicketReportIds(supabase, reportId);
  if (!ticket) return;

  await supabase.from("reports").update({ claimed_by: null, claimed_at: null }).in("id", ticket.ids);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  revalidatePath(`/mod/reports/${reportId}`);
}

export type AddNoteState = { error: string } | null;

// An internal, staff-only note on a ticket (report_notes,
// 0030_report_tickets.sql) — for leaving context/handoff notes, separate
// from resolution_note (which is written once, at close time, and is
// really "why this was resolved this way" rather than a running log).
export async function addReportNote(
  _prevState: AddNoteState,
  formData: FormData,
): Promise<AddNoteState> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (reportId.length === 0) return { error: "Missing report." };
  if (body.length === 0) return { error: "Write a note first." };
  if (body.length > 2000) return { error: "Note must be 2000 characters or fewer." };

  const identity = await getReportTargetIdentity(supabase, reportId);
  if (!identity) return { error: "Report not found." };

  const { error } = await supabase.from("report_notes").insert({
    target_type: identity.target_type,
    target_user_id: identity.target_user_id,
    target_post_id: identity.target_post_id,
    target_message_id: identity.target_message_id,
    author_id: user.id,
    body,
  });

  if (error) {
    return { error: `Could not save note: ${error.message}` };
  }

  revalidatePath(`/mod/reports/${reportId}`);
  return null;
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

// Deletes the reported post AND resolves the WHOLE ticket in one step —
// the same underlying delete as forums/actions.ts's deletePost, just
// entered from the queue's workflow instead of the thread view. The
// bulk-resolve happens BEFORE the delete on purpose: forum_posts'
// ON DELETE SET NULL means every report's target_post_id goes null the
// moment the post is gone, which would break the target-identity match —
// resolving first, while target_post_id is still valid, closes out every
// duplicate report on this post, not just the one that was clicked.
export async function deleteReportedPost(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (reportId.length === 0 || postId.length === 0) return;

  const ticket = await findOpenTicketReportIds(supabase, reportId);
  if (ticket) {
    await supabase
      .from("reports")
      .update({
        status: "resolved",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: "Post deleted.",
      })
      .in("id", ticket.ids);
  }

  await supabase.from("forum_posts").delete().eq("id", postId);

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
