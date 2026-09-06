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

// Every report sharing a ticket with `reportId` AND currently at the
// SAME STATUS as that representative report — same target identity (same
// reported post/message/user) — so claim/resolve/dismiss/escalate can
// bulk-apply across every duplicate report on that ticket instead of a
// mod having to click through them one at a time (see
// groupReportsByTarget(), mod/resolve-reports.ts, for the matching
// grouping logic used to render the queue).
//
// Matching on the representative's OWN status (not a hardcoded 'open')
// matters once escalation exists: an escalated ticket's reports are all
// status='escalated', not 'open', so an admin resolving one needs this
// to find its escalated siblings too, not just fall back to the single
// row that happened to be clicked.
//
// Falls back to just `[reportId]` when the live target id has gone null
// (content deleted outside the reports flow, e.g. a direct forum
// delete) — matching on a null id column would otherwise silently sweep
// in every OTHER deleted-content report too.
async function findTicketReportIds(
  supabase: Supa,
  reportId: string,
): Promise<{ ids: string[]; identity: TargetIdentity; status: ReportStatus } | null> {
  const { data: row } = await supabase
    .from("reports")
    .select("target_type, target_user_id, target_post_id, target_message_id, status")
    .eq("id", reportId)
    .maybeSingle();
  if (!row) return null;

  const identity: TargetIdentity = {
    target_type: row.target_type,
    target_user_id: row.target_user_id,
    target_post_id: row.target_post_id,
    target_message_id: row.target_message_id,
  };

  let query = supabase.from("reports").select("id").eq("status", row.status).eq("target_type", identity.target_type);
  if (identity.target_type === "user" && identity.target_user_id) {
    query = query.eq("target_user_id", identity.target_user_id);
  } else if (identity.target_type === "forum_post" && identity.target_post_id) {
    query = query.eq("target_post_id", identity.target_post_id);
  } else if (identity.target_type === "dm_message" && identity.target_message_id) {
    query = query.eq("target_message_id", identity.target_message_id);
  } else {
    return { ids: [reportId], identity, status: row.status };
  }

  const { data } = await query;
  const ids = (data ?? []).map((r) => r.id);
  return { ids: ids.length > 0 ? ids : [reportId], identity, status: row.status };
}

export async function resolveReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  if (reportId.length === 0 || (status !== "resolved" && status !== "dismissed")) return;

  const noteRaw = formData.get("resolution_note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";

  const ticket = await findTicketReportIds(supabase, reportId);
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

  const ticket = await findTicketReportIds(supabase, reportId);
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

  const ticket = await findTicketReportIds(supabase, reportId);
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

  // Adding a note counts as activity on the ticket — bumps claimed_at so
  // the 24h auto-release (see /mod/reports/page.tsx) doesn't free up a
  // ticket a moderator is still actively working, just because the
  // clock started when they first claimed it. Only bumps if THIS mod is
  // the one who claimed it; a note from someone else (or an admin
  // reviewing an escalated ticket) doesn't reset another mod's timer.
  const ticket = await findTicketReportIds(supabase, reportId);
  if (ticket) {
    await supabase
      .from("reports")
      .update({ claimed_at: new Date().toISOString() })
      .in("id", ticket.ids)
      .eq("claimed_by", user.id);
  }

  revalidatePath(`/mod/reports/${reportId}`);
  return null;
}

export type EscalateState = { error: string } | null;

// A moderator's handoff to an admin — for anything they've decided
// warrants a longer restriction or an account ban, which they can't
// issue themselves (see bans' hybrid duration cap, 0031_moderation_
// overhaul.sql). Bulk-applies to every OPEN report on the ticket, same
// as resolve/dismiss — the whole ticket moves to the admin queue
// together, not just the one report that was clicked. Requires the
// ticket to currently be open (findTicketReportIds matches on the
// representative's own status, so escalating an already-escalated or
// closed ticket is a no-op rather than a confusing double-escalation).
export async function escalateReport(
  _prevState: EscalateState,
  formData: FormData,
): Promise<EscalateState> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const escalationReason = String(formData.get("escalation_reason") ?? "").trim();
  const recommendedAction = String(formData.get("recommended_action") ?? "").trim();

  if (reportId.length === 0) return { error: "Missing report." };
  if (escalationReason.length === 0) return { error: "Explain why this needs admin review." };
  if (escalationReason.length > 1000) return { error: "Reason must be 1000 characters or fewer." };
  if (recommendedAction.length > 200) return { error: "Recommendation must be 200 characters or fewer." };

  const ticket = await findTicketReportIds(supabase, reportId);
  if (!ticket || ticket.status !== "open") {
    return { error: "This ticket can't be escalated right now." };
  }

  const { error } = await supabase
    .from("reports")
    .update({
      status: "escalated",
      escalated_by: user.id,
      escalated_at: new Date().toISOString(),
      escalation_reason: escalationReason,
      recommended_action: recommendedAction.length > 0 ? recommendedAction : null,
    })
    .in("id", ticket.ids);

  if (error) {
    return { error: `Could not escalate: ${error.message}` };
  }

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  revalidatePath(`/mod/reports/${reportId}`);
  return null;
}

// Admin-only in practice — reports' UPDATE policy blocks a non-admin
// from touching a report once it's status='escalated' (0031), so a
// moderator's attempt here just quietly updates 0 rows, same "RLS is the
// real gate" pattern as liftBan. Sends the ticket back to the claiming
// moderator's own queue rather than to Unclaimed — they're still the
// one who was investigating it, an admin declining to act on the
// escalation isn't the same as nobody owning it anymore.
export async function returnEscalation(formData: FormData): Promise<void> {
  const { supabase } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  if (reportId.length === 0) return;

  const ticket = await findTicketReportIds(supabase, reportId);
  if (!ticket) return;

  await supabase
    .from("reports")
    .update({
      status: "open",
      escalated_by: null,
      escalated_at: null,
      escalation_reason: null,
      recommended_action: null,
    })
    .in("id", ticket.ids);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  revalidatePath(`/mod/reports/${reportId}`);
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

  const ticket = await findTicketReportIds(supabase, reportId);
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
// (expires_at > issued_at)" constraint). Hybrid ban authority
// (0031_moderation_overhaul.sql): admins can issue any ban directly; a
// moderator can only issue non-account bans capped at 7 days — anything
// past that (including any account ban) requires escalating the report
// to an admin instead (see escalateReport above). A moderator hitting
// either limit here still gets a friendly message instead of a raw RLS
// error, since bans' INSERT policy is the real gate.
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
    const needsEscalation = banType === "account" || durationHours > 24 * 7;
    return {
      error: needsEscalation
        ? "That ban needs admin approval — escalate the report to an admin instead of issuing it directly."
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

// Appeals: approving lifts the underlying ban; denying just closes the
// appeal out and leaves the ban as-is. Both rely entirely on appeals'
// own UPDATE policy (0031_moderation_overhaul.sql) to reject a staff
// member reviewing an appeal on a ban THEY issued — "the person
// reviewing isn't the person who made the original decision" — so an
// attempt here from the issuing mod/admin just quietly updates 0 rows,
// same "RLS is the real gate" pattern as liftBan.
export async function approveAppeal(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const appealId = String(formData.get("appeal_id") ?? "");
  const banId = String(formData.get("ban_id") ?? "");
  const reviewNoteRaw = formData.get("review_note");
  const reviewNote = typeof reviewNoteRaw === "string" ? reviewNoteRaw.trim() : "";
  if (appealId.length === 0 || banId.length === 0) return;

  const { error } = await supabase
    .from("appeals")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote.length > 0 ? reviewNote : null,
    })
    .eq("id", appealId);

  if (!error) {
    await supabase.from("bans").update({ lifted_at: new Date().toISOString(), lifted_by: user.id }).eq("id", banId);
  }

  revalidatePath("/mod/appeals");
}

export async function denyAppeal(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const appealId = String(formData.get("appeal_id") ?? "");
  const reviewNoteRaw = formData.get("review_note");
  const reviewNote = typeof reviewNoteRaw === "string" ? reviewNoteRaw.trim() : "";
  if (appealId.length === 0) return;

  await supabase
    .from("appeals")
    .update({
      status: "denied",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote.length > 0 ? reviewNote : null,
    })
    .eq("id", appealId);

  revalidatePath("/mod/appeals");
}

// ── Support tickets — same claim shape as reports, but two-way and its
// own pair of tables (0031_moderation_overhaul.sql) ─────────────────

export async function claimTicket(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const ticketId = String(formData.get("ticket_id") ?? "");
  if (ticketId.length === 0) return;

  await supabase
    .from("support_tickets")
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", ticketId);

  revalidatePath("/mod/support");
  revalidatePath(`/mod/support/${ticketId}`);
}

export async function unclaimTicket(formData: FormData): Promise<void> {
  const { supabase } = await requireModerator();

  const ticketId = String(formData.get("ticket_id") ?? "");
  if (ticketId.length === 0) return;

  await supabase.from("support_tickets").update({ claimed_by: null, claimed_at: null }).eq("id", ticketId);

  revalidatePath("/mod/support");
  revalidatePath(`/mod/support/${ticketId}`);
}

export async function closeTicket(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const ticketId = String(formData.get("ticket_id") ?? "");
  if (ticketId.length === 0) return;

  await supabase
    .from("support_tickets")
    .update({ status: "closed", closed_by: user.id, closed_at: new Date().toISOString() })
    .eq("id", ticketId);

  revalidatePath("/mod/support");
  revalidatePath(`/mod/support/${ticketId}`);
}

// Re-opening is staff-only (support_tickets' UPDATE policy is staff-wide)
// — a player can't reopen their own closed ticket, they'd file a new one
// instead (same convention as the player-facing page's copy).
export async function reopenTicket(formData: FormData): Promise<void> {
  const { supabase } = await requireModerator();

  const ticketId = String(formData.get("ticket_id") ?? "");
  if (ticketId.length === 0) return;

  await supabase
    .from("support_tickets")
    .update({ status: "open", closed_by: null, closed_at: null })
    .eq("id", ticketId);

  revalidatePath("/mod/support");
  revalidatePath(`/mod/support/${ticketId}`);
}

export type StaffTicketReplyState = { error: string } | null;

export async function sendStaffTicketReply(
  _prevState: StaffTicketReplyState,
  formData: FormData,
): Promise<StaffTicketReplyState> {
  const { supabase, user } = await requireModerator();

  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (ticketId.length === 0) return { error: "Missing ticket." };
  if (body.length === 0) return { error: "Type a message first." };
  if (body.length > 4000) return { error: "Messages must be 4000 characters or fewer." };

  const { error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, sender_id: user.id, body });

  if (error) {
    return { error: "Could not send that message — the ticket may be closed." };
  }

  revalidatePath(`/mod/support/${ticketId}`);
  return null;
}
