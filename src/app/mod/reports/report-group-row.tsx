import Link from "next/link";
import { CATEGORY_LABELS, targetSummaryLine } from "../report-card";
import { formatShortDate } from "@/lib/format-forum-date";
import type { ReportGroup } from "@/lib/supabase/types";

const TARGET_TYPE_ICON_LABEL: Record<string, string> = {
  user: "Player",
  forum_post: "Forum post",
  dm_message: "Direct message",
};

// One row per ticket (a report or a group of duplicate reports sharing
// the same target) — the compact queue view. Shared by /mod/reports and
// /mod/players/[userId]'s report-history section so both read as the
// same ticket system instead of one being a list of cards and the other
// a table.
export function ReportGroupRow({ group, viewerId }: { group: ReportGroup; viewerId: string }) {
  const { report } = group;
  const categoryLabel =
    group.categories.length === 1
      ? (CATEGORY_LABELS[group.categories[0]] ?? group.categories[0])
      : `${group.categories.length} categories`;
  const isMine = report.claimed_by === viewerId;

  return (
    <tr className="border-t border-amber-200 hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900">
      <td className="px-4 py-2.5">
        <Link href={`/mod/reports/${report.id}`} className="font-medium hover:underline">
          {targetSummaryLine(report)}
        </Link>
        <p className="text-xs text-stone-500">{TARGET_TYPE_ICON_LABEL[report.target_type] ?? report.target_type}</p>
      </td>
      <td className="px-4 py-2.5">{categoryLabel}</td>
      <td className="px-4 py-2.5">
        {group.reportCount > 1 ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {group.reportCount} reports
          </span>
        ) : (
          <span className="text-stone-500">1 report</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-stone-500">{formatShortDate(group.oldestCreatedAt)}</td>
      <td className="px-4 py-2.5 text-xs">
        {report.claimed_by ? (
          <span className={isMine ? "font-medium text-amber-800 dark:text-amber-200" : "text-stone-500"}>
            {isMine ? "You" : report.claimedByName}
          </span>
        ) : (
          <span className="italic text-stone-400">Unclaimed</span>
        )}
      </td>
    </tr>
  );
}
