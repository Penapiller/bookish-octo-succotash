import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BanRow,
  Database,
  ReportGroup,
  ReportNoteRow,
  ReportNoteWithAuthor,
  ReportRow,
  ReportWithDetails,
} from "@/lib/supabase/types";
import { STAFF_USER_ID } from "@/lib/staff-account";

// Shared by /mod/reports, /mod/reports/[reportId], /mod/players/[userId],
// and the player-facing /reports — all need the same reporter/target-
// content resolution (batched user_profiles/forum_posts/dm_messages
// lookups, never per-row joins) to go from raw ReportRow[] to something
// renderable.
export async function resolveReportDetails(
  supabase: SupabaseClient<Database>,
  reports: ReportRow[],
): Promise<ReportWithDetails[]> {
  const userIds = [
    ...new Set(
      reports.flatMap((r) => [
        r.reporter_id,
        r.target_user_id,
        r.resolved_by,
        r.claimed_by,
        r.escalated_by,
        r.target_post_author_id,
        r.target_message_sender_id,
      ].filter((id): id is string => id !== null)),
    ),
  ];
  const postIds = [...new Set(reports.map((r) => r.target_post_id).filter((id): id is string => id !== null))];
  const messageIds = [
    ...new Set(reports.map((r) => r.target_message_id).filter((id): id is string => id !== null)),
  ];

  const [{ data: profilesData }, { data: postsData }, { data: messagesData }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("user_profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? supabase.from("forum_posts").select("id, thread_id, body_raw").in("id", postIds)
      : Promise.resolve({ data: [] }),
    messageIds.length > 0
      ? supabase.from("dm_messages").select("id, conversation_id, body").in("id", messageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));
  const postById = new Map((postsData ?? []).map((p) => [p.id, p]));
  const messageById = new Map((messagesData ?? []).map((m) => [m.id, m]));

  const threadIds = [...new Set((postsData ?? []).map((p) => p.thread_id))];
  const { data: threadsData } =
    threadIds.length > 0
      ? await supabase.from("forum_threads").select("id, category_id, title").in("id", threadIds)
      : { data: [] };
  const threadById = new Map((threadsData ?? []).map((t) => [t.id, t]));

  return reports.map((r) => {
    const post = r.target_post_id ? postById.get(r.target_post_id) : null;
    const thread = post ? threadById.get(post.thread_id) : null;
    const message = r.target_message_id ? messageById.get(r.target_message_id) : null;

    return {
      id: r.id,
      target_type: r.target_type,
      category: r.category,
      details: r.details,
      status: r.status,
      resolved_at: r.resolved_at,
      resolution_note: r.resolution_note,
      claimed_by: r.claimed_by,
      claimed_at: r.claimed_at,
      priority: r.priority,
      escalated_by: r.escalated_by,
      escalated_at: r.escalated_at,
      escalation_reason: r.escalation_reason,
      recommended_action: r.recommended_action,
      created_at: r.created_at,
      reporterId: r.reporter_id,
      reporterName: profileById.get(r.reporter_id)?.display_name ?? "Unknown",
      targetUserId: r.target_user_id,
      targetUserName: r.target_user_id ? (profileById.get(r.target_user_id)?.display_name ?? "Unknown") : null,
      targetPostId: r.target_post_id,
      targetPostBody: post?.body_raw ?? null,
      targetPostAuthorId: r.target_post_author_id,
      targetPostAuthorName: r.target_post_author_id
        ? (profileById.get(r.target_post_author_id)?.display_name ?? "Unknown")
        : null,
      targetThreadId: post?.thread_id ?? null,
      targetCategoryId: thread?.category_id ?? null,
      targetMessageId: r.target_message_id,
      targetMessageBody: message?.body ?? null,
      targetMessageSenderId: r.target_message_sender_id,
      targetMessageSenderName: r.target_message_sender_id
        ? (profileById.get(r.target_message_sender_id)?.display_name ?? "Unknown")
        : null,
      targetMessageConversationId: message?.conversation_id ?? null,
      resolvedByName: r.resolved_by ? (profileById.get(r.resolved_by)?.display_name ?? "Unknown") : null,
      claimedByName: r.claimed_by ? (profileById.get(r.claimed_by)?.display_name ?? "Unknown") : null,
      escalatedByName: r.escalated_by ? (profileById.get(r.escalated_by)?.display_name ?? "Unknown") : null,
    };
  });
}

// One "ticket" = every report sharing the same target — same target_type
// plus whichever of target_post_id/target_message_id/target_user_id is
// non-null. Deliberately computed in application code rather than a
// schema change (see 0030_report_tickets.sql's header comment): grouping
// this way means claim/resolve/dismiss can bulk-apply to a whole ticket
// just by looking up one representative report's target identity
// server-side, with no separate "ticket" table to keep in sync.
//
// If the underlying content has since been deleted (target_post_id/
// target_message_id go null via ON DELETE SET NULL), that report is
// deliberately NOT grouped with every OTHER deleted-content report —
// falling back to grouping by null id columns would silently merge
// unrelated tickets. It renders as its own singleton group instead,
// keyed by its own id.
export function groupReportsByTarget(reports: ReportWithDetails[]): ReportGroup[] {
  const groups = new Map<string, ReportWithDetails[]>();

  for (const report of reports) {
    let key: string;
    if (report.target_type === "user" && report.targetUserId) {
      key = `user:${report.targetUserId}`;
    } else if (report.target_type === "forum_post" && report.targetPostId) {
      key = `post:${report.targetPostId}`;
    } else if (report.target_type === "dm_message" && report.targetMessageId) {
      key = `message:${report.targetMessageId}`;
    } else {
      key = `solo:${report.id}`;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.push(report);
    } else {
      groups.set(key, [report]);
    }
  }

  return [...groups.entries()].map(([key, members]) => {
    const sorted = [...members].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return {
      key,
      report: sorted[0],
      reportCount: sorted.length,
      categories: [...new Set(sorted.map((r) => r.category))],
      oldestCreatedAt: sorted[0].created_at,
      newestCreatedAt: sorted[sorted.length - 1].created_at,
    };
  });
}

type TargetIdentity = {
  target_type: ReportRow["target_type"];
  target_user_id: string | null;
  target_post_id: string | null;
  target_message_id: string | null;
};

// Every report sharing a ticket with `identity`, any status — used by
// the ticket detail page to show the full duplicate history (unlike
// mod/actions.ts's findOpenTicketReportIds, which only needs OPEN rows
// since it's driving bulk claim/resolve/dismiss). Falls back to just the
// one representative report when the live target id has gone null
// (content deleted outside the reports flow) — same reasoning as
// findOpenTicketReportIds: matching on a null id column would otherwise
// silently sweep in every other deleted-content ticket too.
export async function fetchTicketReports(
  supabase: SupabaseClient<Database>,
  identity: TargetIdentity,
  fallbackReportId: string,
): Promise<ReportRow[]> {
  let query = supabase.from("reports").select("*").eq("target_type", identity.target_type);
  if (identity.target_type === "user" && identity.target_user_id) {
    query = query.eq("target_user_id", identity.target_user_id);
  } else if (identity.target_type === "forum_post" && identity.target_post_id) {
    query = query.eq("target_post_id", identity.target_post_id);
  } else if (identity.target_type === "dm_message" && identity.target_message_id) {
    query = query.eq("target_message_id", identity.target_message_id);
  } else {
    query = query.eq("id", fallbackReportId);
  }

  const { data } = await query.order("created_at", { ascending: true });
  return (data ?? []) as ReportRow[];
}

// The internal notes attached to the same ticket. Returns nothing when
// the live target id is null, rather than risk matching every other
// deleted-content ticket's notes too — see fetchTicketReports above.
export async function fetchTicketNotes(
  supabase: SupabaseClient<Database>,
  identity: TargetIdentity,
): Promise<ReportNoteRow[]> {
  let query = supabase.from("report_notes").select("*").eq("target_type", identity.target_type);
  if (identity.target_type === "user" && identity.target_user_id) {
    query = query.eq("target_user_id", identity.target_user_id);
  } else if (identity.target_type === "forum_post" && identity.target_post_id) {
    query = query.eq("target_post_id", identity.target_post_id);
  } else if (identity.target_type === "dm_message" && identity.target_message_id) {
    query = query.eq("target_message_id", identity.target_message_id);
  } else {
    return [];
  }

  const { data } = await query.order("created_at", { ascending: true });
  return (data ?? []) as ReportNoteRow[];
}

// For an escalated ticket's admin view — "Previous actions: 2 warnings,
// 1 temporary restriction" context so an admin isn't deciding on a
// permanent/account ban in a vacuum. warningCount counts every message
// ever sent from the Staff/Community Team account to this player
// (report acks, canned/custom warnings, and quick quotes all go through
// the same send_staff_message() path, so this is a reasonable proxy for
// "how many times has staff had to say something to them" without a
// separate warnings table to maintain).
export async function getModerationHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ bans: BanRow[]; warningCount: number }> {
  // dm_conversations stores its pair in canonical (user_one_id <
  // user_two_id) order (see 0026_direct_messages.sql) — computing that
  // ordering directly and matching on both columns avoids chaining two
  // .or() calls, which would generate two separate `or=` query params
  // that don't AND together the way a naive read suggests (the exact
  // bug fixed on the marketplace browse page earlier in this project).
  const [staffConvUserOne, staffConvUserTwo] =
    STAFF_USER_ID < userId ? [STAFF_USER_ID, userId] : [userId, STAFF_USER_ID];

  const [{ data: bans }, { data: conversation }] = await Promise.all([
    supabase.from("bans").select("*").eq("user_id", userId).order("issued_at", { ascending: false }),
    supabase
      .from("dm_conversations")
      .select("id")
      .eq("user_one_id", staffConvUserOne)
      .eq("user_two_id", staffConvUserTwo)
      .maybeSingle(),
  ]);

  let warningCount = 0;
  if (conversation) {
    const { count } = await supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("sender_id", STAFF_USER_ID);
    warningCount = count ?? 0;
  }

  return { bans: (bans ?? []) as BanRow[], warningCount };
}

// Same author-name-resolution pattern as resolveReportDetails, for the
// internal notes thread on a ticket's detail page.
export async function resolveReportNotes(
  supabase: SupabaseClient<Database>,
  notes: ReportNoteRow[],
): Promise<ReportNoteWithAuthor[]> {
  const authorIds = [...new Set(notes.map((n) => n.author_id))];
  const { data: profilesData } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name").in("id", authorIds)
      : { data: [] };
  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

  return notes.map((n) => ({
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    authorName: nameById.get(n.author_id) ?? "Unknown",
  }));
}
