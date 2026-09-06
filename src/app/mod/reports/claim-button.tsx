import { claimReport, unclaimReport } from "../actions";

// Plain form actions, same "just does the thing" convention as
// ResolveReportForm — any staff member can claim or unclaim any ticket,
// there's no ownership check beyond requireModerator() itself.
export function ClaimButton({
  reportId,
  claimedByName,
  isMine,
}: {
  reportId: string;
  claimedByName: string | null;
  isMine: boolean;
}) {
  if (!claimedByName) {
    return (
      <form action={claimReport}>
        <input type="hidden" name="report_id" value={reportId} />
        <button
          type="submit"
          className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
        >
          Claim
        </button>
      </form>
    );
  }

  return (
    <form action={unclaimReport} className="flex items-center gap-2">
      <input type="hidden" name="report_id" value={reportId} />
      <span className="text-xs text-stone-500">
        Claimed by <span className="font-medium">{isMine ? "you" : claimedByName}</span>
      </span>
      <button
        type="submit"
        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        Unclaim
      </button>
    </form>
  );
}
