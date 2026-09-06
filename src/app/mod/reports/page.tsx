import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails, groupReportsByTarget } from "../resolve-reports";
import { ReportGroupRow } from "./report-group-row";
import type { ReportRow } from "@/lib/supabase/types";

type Tab = "unclaimed" | "mine" | "open" | "history";

const TABS: { value: Tab; label: string }[] = [
  { value: "unclaimed", label: "Unclaimed" },
  { value: "mine", label: "My claims" },
  { value: "open", label: "All open" },
  { value: "history", label: "History" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Grouped ticket queue: multiple reports on the same post/message/player
// collapse into one row (see groupReportsByTarget()), so a mod clicks
// through tickets, not through every individual report that piled up on
// the same piece of content. Tabs replace the old flat open/resolved/
// dismissed status filter with a claim-aware workflow — "what's not
// spoken for yet," "what I'm already working," "everything still open
// regardless of claim," and the closed-out history.
export default async function ModReportsPage(props: PageProps<"/mod/reports">) {
  const { supabase, user } = await requireModerator();
  const searchParams = await props.searchParams;
  const tabParam = first(searchParams.tab);
  const activeTab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : "unclaimed";

  let query = supabase.from("reports").select("*");
  if (activeTab === "unclaimed") {
    query = query.eq("status", "open").is("claimed_by", null);
  } else if (activeTab === "mine") {
    query = query.eq("status", "open").eq("claimed_by", user.id);
  } else if (activeTab === "open") {
    query = query.eq("status", "open");
  } else {
    query = query.in("status", ["resolved", "dismissed"]);
  }
  query = query.order("created_at", { ascending: activeTab !== "history" });

  const { data: reportsData } = await query;
  const reports = await resolveReportDetails(supabase, (reportsData ?? []) as ReportRow[]);
  const groups = groupReportsByTarget(reports);

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-amber-200 dark:border-stone-800">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/reports?tab=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === tab.value
                ? "border-amber-800 font-medium dark:border-amber-200"
                : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="text-sm italic text-stone-500">Nothing here.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-amber-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead className="bg-amber-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
              <tr>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Reports</th>
                <th className="px-4 py-2">Filed</th>
                <th className="px-4 py-2">Claim</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <ReportGroupRow key={group.key} group={group} viewerId={user.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
