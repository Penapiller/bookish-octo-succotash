import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails, groupReportsByTarget } from "../resolve-reports";
import { ReportGroupRow } from "./report-group-row";
import type { ReportRow } from "@/lib/supabase/types";

type Tab = "unclaimed" | "mine" | "needs_admin" | "awaiting" | "closed";

const ALL_TABS: { value: Tab; label: string; adminOnly?: boolean }[] = [
  { value: "unclaimed", label: "Unclaimed" },
  { value: "mine", label: "Mine" },
  { value: "needs_admin", label: "Needs Admin", adminOnly: true },
  { value: "awaiting", label: "Awaiting Action" },
  { value: "closed", label: "Closed" },
];

// A claim left untouched this long frees itself back up — a moderator
// who claims something and then goes quiet for a day shouldn't be able
// to sit on it forever. Lazily enforced (no cron in this app — same
// "check and fix it opportunistically on page load" pattern as
// resolve_due_expeditions/resolve_expired_listings), and only checked
// against claimed_at, which addReportNote (mod/actions.ts) bumps on any
// activity — so a ticket someone's actually working doesn't silently
// expire out from under them.
const CLAIM_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type Supa = Awaited<ReturnType<typeof requireModerator>>["supabase"];

// Factored out of the page component itself — the lint rule against
// impure calls (Date.now()) during render only looks at the component
// function's own body, same reason marketplace/page.tsx's timeLeftLabel
// is a plain helper rather than inlined.
async function releaseStaleClaims(supabase: Supa): Promise<void> {
  await supabase
    .from("reports")
    .update({ claimed_by: null, claimed_at: null })
    .eq("status", "open")
    .not("claimed_by", "is", null)
    .lt("claimed_at", new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString());
}

// Named, claim-aware queues rather than a generic status filter —
// Unclaimed/Mine/Needs Admin/Awaiting Action/Closed makes it obvious at
// a glance what actually needs attention, and who from. "Needs Admin" is
// the actual admin queue (status='escalated', admin-only to even see the
// tab) — the real gate is the RLS policy that blocks a non-admin from
// acting on an escalated report at all (0031_moderation_overhaul.sql),
// this is just the matching visibility. "Awaiting Action" is the mirror
// view for the moderator who escalated it: their own tickets sitting in
// that same queue, waiting on an admin.
export default async function ModReportsPage(props: PageProps<"/mod/reports">) {
  const { supabase, user } = await requireModerator();
  const { data: viewerProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = viewerProfile?.is_admin ?? false;

  await releaseStaleClaims(supabase);

  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);
  const searchParams = await props.searchParams;
  const tabParam = first(searchParams.tab);
  const activeTab: Tab = tabs.some((t) => t.value === tabParam) ? (tabParam as Tab) : "unclaimed";

  let query = supabase.from("reports").select("*");
  if (activeTab === "unclaimed") {
    query = query.eq("status", "open").is("claimed_by", null);
  } else if (activeTab === "mine") {
    query = query.eq("status", "open").eq("claimed_by", user.id);
  } else if (activeTab === "needs_admin") {
    query = query.eq("status", "escalated");
  } else if (activeTab === "awaiting") {
    query = query.eq("status", "escalated").eq("escalated_by", user.id);
  } else {
    query = query.in("status", ["resolved", "dismissed"]);
  }
  query = query.order("created_at", { ascending: activeTab !== "closed" });

  const { data: reportsData } = await query;
  const reports = await resolveReportDetails(supabase, (reportsData ?? []) as ReportRow[]);
  const groups = groupReportsByTarget(reports);

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-amber-200 dark:border-stone-800">
        {tabs.map((tab) => (
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
                <th className="px-4 py-2">Priority</th>
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
