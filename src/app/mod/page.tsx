import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails, groupReportsByTarget } from "./resolve-reports";
import type { ReportRow } from "@/lib/supabase/types";

export default async function ModDashboardPage() {
  const { supabase } = await requireModerator();

  const [{ data: openRowsData }, { count: unclaimedCount }, { count: resolvedCount }, { count: dismissedCount }] =
    await Promise.all([
      // Open counts reflect TICKETS (distinct targets), not raw report
      // rows — 5 duplicate reports on one post should read as "1 open
      // ticket," matching what the queue actually shows.
      supabase.from("reports").select("*").eq("status", "open"),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open").is("claimed_by", null),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "dismissed"),
    ]);

  const openReports = await resolveReportDetails(supabase, (openRowsData ?? []) as ReportRow[]);
  const openTicketCount = groupReportsByTarget(openReports).length;

  const cards = [
    { href: "/mod/reports?tab=open", label: "Open tickets", count: openTicketCount },
    { href: "/mod/reports?tab=unclaimed", label: "Unclaimed reports", count: unclaimedCount ?? 0 },
    { href: "/mod/reports?tab=history", label: "Resolved", count: resolvedCount ?? 0 },
    { href: "/mod/reports?tab=history", label: "Dismissed", count: dismissedCount ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="flex flex-col gap-1 rounded-lg border border-amber-200 p-4 hover:bg-amber-100 dark:border-stone-800 dark:hover:bg-stone-900"
        >
          <span className="text-2xl font-semibold tracking-tight">{card.count}</span>
          <span className="text-sm text-stone-500">{card.label}</span>
        </Link>
      ))}
    </div>
  );
}
