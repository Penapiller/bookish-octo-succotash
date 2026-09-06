import { claimTicket, unclaimTicket } from "../actions";

// Same shape as reports' ClaimButton (mod/reports/claim-button.tsx) —
// duplicated rather than shared, since the two tie to different tables
// and hidden field names (ticket_id vs report_id) and support tickets
// don't have the "bulk-apply to a whole ticket group" complexity reports
// do (a support ticket is never deduplicated with another).
export function TicketClaimButton({
  ticketId,
  claimedByName,
  isMine,
}: {
  ticketId: string;
  claimedByName: string | null;
  isMine: boolean;
}) {
  if (!claimedByName) {
    return (
      <form action={claimTicket}>
        <input type="hidden" name="ticket_id" value={ticketId} />
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
    <form action={unclaimTicket} className="flex items-center gap-2">
      <input type="hidden" name="ticket_id" value={ticketId} />
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
