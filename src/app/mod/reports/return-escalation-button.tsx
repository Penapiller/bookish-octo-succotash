import { returnEscalation } from "../actions";

// Admin-only in practice (the RLS backstop on reports' UPDATE policy is
// what actually enforces it — see 0031_moderation_overhaul.sql); only
// rendered for admins to begin with. Sends the ticket back to the
// escalating moderator's own queue rather than to Unclaimed.
export function ReturnEscalationButton({ reportId }: { reportId: string }) {
  return (
    <form action={returnEscalation}>
      <input type="hidden" name="report_id" value={reportId} />
      <button
        type="submit"
        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        Return to moderator
      </button>
    </form>
  );
}
