import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveReportDetails } from "@/app/mod/resolve-reports";
import { CATEGORY_LABELS } from "@/lib/report-labels";
import { targetSummaryLine } from "@/app/mod/report-card";
import { formatForumDate } from "@/lib/format-forum-date";
import type { ReportRow, ReportStatus } from "@/lib/supabase/types";

// Closes the loop the old flow left open: a player who files a report
// previously only ever heard back once (the automatic "we got it" DM from
// Staff) and had no way to check on it afterward. This shows their own
// filed reports and a plain status, deliberately without exposing
// resolution_note or who resolved it — that's staff-internal detail (and
// would sometimes reveal a specific mod's involvement, contradicting the
// mod-anonymity design elsewhere in this app).
const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Under review",
  resolved: "Action taken",
  dismissed: "No violation found",
};

const STATUS_CLASSES: Record<ReportStatus, string> = {
  open: "text-amber-700 dark:text-amber-300",
  resolved: "text-green-700 dark:text-green-400",
  dismissed: "text-stone-500",
};

export default async function MyReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reportsData } = await supabase
    .from("reports")
    .select("*")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false });

  const reports = await resolveReportDetails(supabase, (reportsData ?? []) as ReportRow[]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Reports</h1>
        <p className="text-sm text-stone-500">
          Reports you&apos;ve filed and their current status. Staff review every report, even ones that
          don&apos;t end up needing action.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm italic text-stone-500">You haven&apos;t filed any reports.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800"
            >
              <div>
                <p className="text-sm">
                  Reported <span className="font-medium">{targetSummaryLine(report)}</span> —{" "}
                  {CATEGORY_LABELS[report.category] ?? report.category}
                </p>
                <p className="text-xs text-stone-500">{formatForumDate(report.created_at)}</p>
              </div>
              <span className={`text-sm font-medium ${STATUS_CLASSES[report.status]}`}>
                {STATUS_LABELS[report.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
