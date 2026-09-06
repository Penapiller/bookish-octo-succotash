import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import {
  resolveReportDetails,
  resolveReportNotes,
  fetchTicketReports,
  fetchTicketNotes,
  getModerationHistory,
} from "../../resolve-reports";
import { ReportTargetSummary, ReportEntry, offendingUserId, CATEGORY_LABELS } from "../../report-card";
import { ClaimButton } from "../claim-button";
import { ResolveReportForm } from "../resolve-report-form";
import { DeleteReportedPostButton } from "../delete-reported-post-button";
import { QuickQuoteButton } from "../../quick-quote-button";
import { NoteThread } from "../note-thread";
import { EscalateForm } from "../escalate-form";
import { ReturnEscalationButton } from "../return-escalation-button";
import { BanForm } from "../../players/[userId]/ban-form";
import type { ReportRow } from "@/lib/supabase/types";

const BAN_TYPE_LABELS: Record<string, string> = {
  dm: "DM ban",
  sales: "Sales ban",
  forums: "Forums ban",
  account: "Account ban",
};

// The full ticket view — every report sharing this target (see
// fetchTicketReports()), the target content rendered once, claim state,
// bulk resolve/dismiss/delete-post/quick-quote/escalate actions, and the
// internal notes thread. Reached from a row in /mod/reports or
// /mod/players/[userId] — the URL always names one representative
// report, but every action here applies to the whole ticket, not just
// that one row.
export default async function ReportTicketPage(props: PageProps<"/mod/reports/[reportId]">) {
  const { reportId } = await props.params;
  const { supabase, user } = await requireModerator();
  const { data: viewerProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = viewerProfile?.is_admin ?? false;

  const { data: primaryRow } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (!primaryRow) {
    notFound();
  }

  const identity = {
    target_type: primaryRow.target_type,
    target_user_id: primaryRow.target_user_id,
    target_post_id: primaryRow.target_post_id,
    target_message_id: primaryRow.target_message_id,
  };

  const [ticketRows, noteRows] = await Promise.all([
    fetchTicketReports(supabase, identity, reportId),
    fetchTicketNotes(supabase, identity),
  ]);

  const reports = await resolveReportDetails(supabase, ticketRows as ReportRow[]);
  const notes = await resolveReportNotes(supabase, noteRows);

  const representative = reports.find((r) => r.id === reportId) ?? reports[0];
  const isOpen = representative.status === "open";
  const isEscalated = representative.status === "escalated";
  const target = offendingUserId(representative);
  const isClaimedByMe = representative.claimed_by === user.id;

  const moderationHistory = target && isEscalated ? await getModerationHistory(supabase, target) : null;

  const quotableContent =
    representative.target_type === "forum_post"
      ? representative.targetPostBody
      : representative.target_type === "dm_message"
        ? representative.targetMessageBody
        : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/mod/reports" className="text-sm text-stone-500 hover:underline">
          ← Back to queue
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {reports.length} {reports.length === 1 ? "report" : "reports"} —{" "}
            {[...new Set(reports.map((r) => CATEGORY_LABELS[r.category] ?? r.category))].join(", ")}
          </h1>
          {target ? (
            <Link href={`/mod/players/${target}`} className="text-xs text-stone-500 underline">
              View full history for this player
            </Link>
          ) : null}
        </div>
        {isOpen ? (
          <ClaimButton
            reportId={reportId}
            claimedByName={representative.claimedByName}
            isMine={isClaimedByMe}
          />
        ) : null}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Reported content</h2>
        <ReportTargetSummary report={representative} />
      </section>

      {isOpen ? (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
          <ResolveReportForm reportId={reportId} status="resolved" label="Mark resolved" />
          <ResolveReportForm reportId={reportId} status="dismissed" label="Dismiss" />
          {representative.target_type === "forum_post" && representative.targetPostId ? (
            <DeleteReportedPostButton reportId={reportId} postId={representative.targetPostId} />
          ) : null}
          {target && quotableContent ? (
            <QuickQuoteButton targetUserId={target} quotedContent={quotableContent} />
          ) : null}
          <EscalateForm reportId={reportId} />
        </section>
      ) : isEscalated ? (
        <section className="flex flex-col gap-4 rounded-lg border-2 border-amber-400 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              ⚠ Admin review required
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Escalated by</span> {representative.escalatedByName} on{" "}
              {representative.escalated_at ? new Date(representative.escalated_at).toLocaleString() : ""}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Reason:</span> {representative.escalation_reason}
            </p>
            {representative.recommended_action ? (
              <p className="mt-1 text-sm">
                <span className="font-medium">Moderator recommendation:</span> {representative.recommended_action}
              </p>
            ) : null}
          </div>

          {moderationHistory ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Previous actions</p>
              {moderationHistory.warningCount === 0 && moderationHistory.bans.length === 0 ? (
                <p className="text-sm italic text-stone-500">No prior warnings or bans on record.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {moderationHistory.warningCount > 0 ? (
                    <li>
                      {moderationHistory.warningCount} staff message{moderationHistory.warningCount === 1 ? "" : "s"}{" "}
                      sent previously
                    </li>
                  ) : null}
                  {moderationHistory.bans.map((b) => (
                    <li key={b.id}>
                      {BAN_TYPE_LABELS[b.ban_type] ?? b.ban_type} — issued {new Date(b.issued_at).toLocaleDateString()}
                      {b.lifted_at ? " (lifted early)" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {isAdmin ? (
            <div className="flex flex-col gap-4 border-t border-amber-300 pt-4 dark:border-amber-800">
              {target ? <BanForm targetUserId={target} isAdmin={true} /> : null}
              <div className="flex flex-wrap gap-2">
                <ResolveReportForm reportId={reportId} status="resolved" label="Resolve (ban issued or action taken)" />
                <ResolveReportForm reportId={reportId} status="dismissed" label="Dismiss escalation" />
                <ReturnEscalationButton reportId={reportId} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Waiting on an admin to review this case.</p>
          )}
        </section>
      ) : (
        <p className="rounded-lg border border-amber-200 p-4 text-sm text-stone-500 dark:border-stone-800">
          This ticket is closed — every report on it has been resolved or dismissed.
          {representative.escalated_by ? ` It was escalated by ${representative.escalatedByName}.` : ""}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Reports on this ticket ({reports.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {reports.map((report) => (
            <ReportEntry key={report.id} report={report} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Internal notes</h2>
        <NoteThread notes={notes} reportId={reportId} />
      </section>
    </div>
  );
}
