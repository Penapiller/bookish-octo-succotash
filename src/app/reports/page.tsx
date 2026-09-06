import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/report-labels";
import { targetSummaryLine } from "@/app/mod/report-card";
import { formatForumDate } from "@/lib/format-forum-date";
import { resolveReportDetails } from "@/app/mod/resolve-reports";
import type { ReportRow } from "@/lib/supabase/types";

// Deliberately does NOT show a status (Pending/Under Review/Resolved) —
// that sets an expectation that staff will keep the player updated,
// which this app's moderation model explicitly doesn't do (staff are
// invisible; a player never learns what, if anything, happened as a
// result of their report). This is a private submission log only: proof
// you reported something and when, nothing about the outcome.
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
          A record of what you&apos;ve reported. Our team reviews every report — we don&apos;t publish outcomes,
          so this only confirms what was submitted and when.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm italic text-stone-500">You haven&apos;t filed any reports.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-lg border border-amber-200 p-4 dark:border-stone-800">
              <p className="text-sm">
                Reported <span className="font-medium">{targetSummaryLine(report)}</span> —{" "}
                {CATEGORY_LABELS[report.category] ?? report.category}
              </p>
              <p className="text-xs text-stone-500">{formatForumDate(report.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
