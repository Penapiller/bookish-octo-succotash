import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/report-labels";
import type { ReportWithDetails } from "@/lib/supabase/types";

// Split into pieces reused across the ticket queue (mod/reports/
// report-group-row.tsx), the ticket detail page (mod/reports/
// [reportId]/page.tsx), and /mod/players/[userId] — a "ticket" is a
// group of reports sharing the same target (see groupReportsByTarget(),
// resolve-reports.ts), so the target content only needs rendering once
// per ticket while each individual report within it still needs its own
// reporter/category/details line.

export { CATEGORY_LABELS };

const TARGET_TYPE_LABELS: Record<string, string> = {
  user: "a player",
  forum_post: "a forum post",
  dm_message: "a direct message",
};

// The player a resolution (ban, warning, quick quote) would actually
// target — the reported player themselves, or whoever authored the
// reported post/message.
export function offendingUserId(report: ReportWithDetails): string | null {
  return report.target_type === "user"
    ? report.targetUserId
    : report.target_type === "forum_post"
      ? report.targetPostAuthorId
      : report.targetMessageSenderId;
}

// A short one-line label for the queue table — "a forum post by Alice",
// "a direct message from Bob", "Carol" for a user report.
export function targetSummaryLine(report: ReportWithDetails): string {
  if (report.target_type === "user") {
    return report.targetUserName ?? "deleted account";
  }
  if (report.target_type === "forum_post") {
    return `post by ${report.targetPostAuthorName ?? "Unknown"}`;
  }
  return `message from ${report.targetMessageSenderName ?? "Unknown"}`;
}

// The reported content itself — rendered once per ticket (not once per
// duplicate report), since every report in a ticket points at the exact
// same target.
export function ReportTargetSummary({ report }: { report: ReportWithDetails }) {
  if (report.target_type === "user") {
    return (
      <p className="text-sm">
        Target:{" "}
        {report.targetUserId ? (
          <Link href={`/u/${report.targetUserId}`} className="font-medium hover:underline">
            {report.targetUserName}
          </Link>
        ) : (
          <span className="italic text-stone-500">deleted account</span>
        )}
      </p>
    );
  }

  if (report.target_type === "forum_post") {
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
        <p className="text-xs text-stone-500">
          Post by{" "}
          {report.targetPostAuthorId ? (
            <Link href={`/u/${report.targetPostAuthorId}`} className="font-medium hover:underline">
              {report.targetPostAuthorName}
            </Link>
          ) : (
            <span className="font-medium">{report.targetPostAuthorName ?? "Unknown"}</span>
          )}
          {report.targetCategoryId && report.targetThreadId ? (
            <>
              {" "}
              —{" "}
              <Link href={`/forums/${report.targetCategoryId}/${report.targetThreadId}`} className="underline">
                View thread
              </Link>
            </>
          ) : (
            " (post deleted)"
          )}
        </p>
        {report.targetPostBody ? (
          <p className="mt-1 whitespace-pre-wrap">{report.targetPostBody}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-100 bg-amber-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
      <p className="text-xs text-stone-500">
        Message from{" "}
        {report.targetMessageSenderId ? (
          <Link href={`/u/${report.targetMessageSenderId}`} className="font-medium hover:underline">
            {report.targetMessageSenderName}
          </Link>
        ) : (
          <span className="font-medium">{report.targetMessageSenderName ?? "Unknown"}</span>
        )}
        {report.targetMessageConversationId ? (
          <>
            {" "}
            —{" "}
            <Link href={`/mod/conversations/${report.targetMessageConversationId}`} className="underline">
              View conversation
            </Link>
          </>
        ) : null}
      </p>
      {report.targetMessageBody ? (
        <p className="mt-1 whitespace-pre-wrap">{report.targetMessageBody}</p>
      ) : (
        <p className="mt-1 italic text-stone-500">Message no longer available.</p>
      )}
    </div>
  );
}

// One individual report within a ticket — who filed it, why, and (if
// closed) how it was resolved. No target content and no action buttons
// here; those live at the ticket level (ReportTargetSummary + the
// detail page's own resolve/dismiss/claim/quick-quote controls) since
// every report in a ticket shares the same target and the same fate.
export function ReportEntry({ report }: { report: ReportWithDetails }) {
  const createdAt = new Date(report.created_at).toLocaleString();

  return (
    <li className="flex flex-col gap-1 rounded-md border border-amber-100 p-3 text-sm dark:border-stone-800">
      <p>
        <Link href={`/u/${report.reporterId}`} className="font-medium hover:underline">
          {report.reporterName}
        </Link>{" "}
        reported {TARGET_TYPE_LABELS[report.target_type] ?? report.target_type} —{" "}
        <span className="font-medium">{CATEGORY_LABELS[report.category] ?? report.category}</span>
      </p>
      <p className="text-xs text-stone-500">{createdAt}</p>
      {report.details ? (
        <p className="text-stone-600 dark:text-stone-400">&ldquo;{report.details}&rdquo;</p>
      ) : null}
      {report.status !== "open" ? (
        <p className="text-xs text-stone-500">
          {report.status === "resolved" ? "Resolved" : "Dismissed"} by{" "}
          <span className="font-medium">{report.resolvedByName}</span>
          {report.resolved_at ? ` at ${new Date(report.resolved_at).toLocaleString()}` : ""}
          {report.resolution_note ? ` — ${report.resolution_note}` : ""}
        </p>
      ) : null}
    </li>
  );
}
