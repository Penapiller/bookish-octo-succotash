import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import {
  resolveReportDetails,
  resolveReportNotes,
  fetchTicketReports,
  fetchTicketNotes,
} from "../../resolve-reports";
import { ReportTargetSummary, ReportEntry, offendingUserId, CATEGORY_LABELS } from "../../report-card";
import { ClaimButton } from "../claim-button";
import { ResolveReportForm } from "../resolve-report-form";
import { DeleteReportedPostButton } from "../delete-reported-post-button";
import { QuickQuoteButton } from "../../quick-quote-button";
import { NoteThread } from "../note-thread";
import type { ReportRow } from "@/lib/supabase/types";

// The full ticket view — every report sharing this target (see
// fetchTicketReports()), the target content rendered once, claim state,
// bulk resolve/dismiss/delete-post/quick-quote actions, and the internal
// notes thread. Reached from a row in /mod/reports or /mod/players/
// [userId] — the URL always names one representative report, but every
// action here (claim/resolve/dismiss/notes) applies to the whole ticket,
// not just that one row.
export default async function ReportTicketPage(props: PageProps<"/mod/reports/[reportId]">) {
  const { reportId } = await props.params;
  const { supabase, user } = await requireModerator();

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
  const openReports = reports.filter((r) => r.status === "open");
  const hasOpenReports = openReports.length > 0;
  const target = offendingUserId(representative);
  const isClaimedByMe = representative.claimed_by === user.id;

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
        {hasOpenReports ? (
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

      {hasOpenReports ? (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
          <ResolveReportForm reportId={reportId} status="resolved" label="Mark resolved" />
          <ResolveReportForm reportId={reportId} status="dismissed" label="Dismiss" />
          {representative.target_type === "forum_post" && representative.targetPostId ? (
            <DeleteReportedPostButton reportId={reportId} postId={representative.targetPostId} />
          ) : null}
          {target && quotableContent ? (
            <QuickQuoteButton targetUserId={target} quotedContent={quotableContent} />
          ) : null}
        </section>
      ) : (
        <p className="rounded-lg border border-amber-200 p-4 text-sm text-stone-500 dark:border-stone-800">
          This ticket is closed — every report on it has been resolved or dismissed.
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
