import { resolveReport } from "../actions";
import type { ReportStatus } from "@/lib/supabase/types";

// Plain server-rendered form — resolveReport is a Server Action, so this
// doesn't need "use client" or any local state to work.
export function ResolveReportForm({
  reportId,
  status,
  label,
}: {
  reportId: string;
  status: ReportStatus;
  label: string;
}) {
  return (
    <form action={resolveReport} className="flex items-center gap-2">
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="status" value={status} />
      <input
        type="text"
        name="resolution_note"
        placeholder="Note (optional)"
        className="w-36 rounded-md border border-amber-300 px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-950"
      />
      <button
        type="submit"
        className={
          status === "resolved"
            ? "rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
            : "rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
        }
      >
        {label}
      </button>
    </form>
  );
}
