import { claimReport, unclaimReport } from "../actions";

// Any staff member can claim or unclaim any report (0033_claiming_and_
// note_edits.sql) — claiming is purely coordination ("I've got this one")
// so two mods don't duplicate work, never an access-control lock, so
// there's no "only the claimant can unclaim" restriction to enforce here.
export function ClaimButton({
  reportId,
  claimedByName,
  isMine,
}: {
  reportId: string;
  claimedByName: string | null;
  isMine: boolean;
}) {
  if (claimedByName === null) {
    return (
      <form action={claimReport}>
        <input type="hidden" name="report_id" value={reportId} />
        <button
          type="submit"
          className="whitespace-nowrap rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
        >
          Claim
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-xs text-stone-500">
      <span>Claimed by {isMine ? "you" : claimedByName}</span>
      <form action={unclaimReport}>
        <input type="hidden" name="report_id" value={reportId} />
        <button type="submit" className="text-amber-800 underline hover:no-underline dark:text-amber-400">
          Unclaim
        </button>
      </form>
    </div>
  );
}
