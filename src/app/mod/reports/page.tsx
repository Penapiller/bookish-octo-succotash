import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails } from "../resolve-reports";
import { ReportCard } from "../report-card";
import type { ReportRow, ReportStatus } from "@/lib/supabase/types";

const TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
    .order("created_at", { ascending: activeStatus === "open" });

  const reportsWithDetails = await resolveReportDetails(supabase, (reportsData ?? []) as ReportRow[]);

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

      {reportsWithDetails.length === 0 ? (
        <p className="text-sm italic text-stone-500">No {activeStatus} reports.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reportsWithDetails.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}
    </div>
  );
}
