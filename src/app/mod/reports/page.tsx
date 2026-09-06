import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails } from "../resolve-reports";
import { CATEGORY_LABELS } from "../report-card";
import type { ReportRow, ReportStatus } from "@/lib/supabase/types";

const TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A plain list — no dedup, no claiming, no priority — each row just
// links out to /mod/reports/[reportId], the single-report handling page
// where all the actual work happens.
export default async function ModReportsPage(props: PageProps<"/mod/reports">) {
  const { supabase } = await requireModerator();
  const searchParams = await props.searchParams;
  const statusParam = first(searchParams.status);
  const activeStatus: ReportStatus = TABS.some((t) => t.value === statusParam)
    ? (statusParam as ReportStatus)
    : "open";

  const { data: reportsData } = await supabase
    .from("reports")
    .select("*")
    .eq("status", activeStatus)
    .order("created_at", { ascending: activeStatus === "open" || activeStatus === "escalated" });

  const reports = await resolveReportDetails(supabase, (reportsData ?? []) as ReportRow[]);

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-amber-200 dark:border-stone-800">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/reports?status=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeStatus === tab.value
                ? "border-amber-800 font-medium dark:border-amber-200"
                : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="text-sm italic text-stone-500">No {activeStatus} reports.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/mod/reports/${report.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 px-4 py-2.5 text-sm hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <span>
                  <span className="font-medium">{report.reporterName}</span> reported{" "}
                  {report.target_type === "user"
                    ? (report.targetUserName ?? "a player")
                    : report.target_type === "forum_post"
                      ? `a post by ${report.targetPostAuthorName ?? "Unknown"}`
                      : `a message from ${report.targetMessageSenderName ?? "Unknown"}`}{" "}
                  — {CATEGORY_LABELS[report.category] ?? report.category}
                </span>
                <span className="text-xs text-stone-500">{new Date(report.created_at).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
