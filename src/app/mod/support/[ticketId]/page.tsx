import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModerator } from "@/lib/moderation";
import { resolveTicketMessages } from "@/app/support/resolve-support";
import { TicketThread } from "@/app/support/ticket-thread";
import { TicketClaimButton } from "../ticket-claim-button";
import { StaffReplyForm } from "../staff-reply-form";
import { closeTicket, reopenTicket } from "../../actions";

export default async function StaffTicketPage(props: PageProps<"/mod/support/[ticketId]">) {
  const { ticketId } = await props.params;
  const { supabase, user } = await requireModerator();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    notFound();
  }

  const [{ data: playerProfile }, { data: claimedByProfile }, messages] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name").eq("id", ticket.player_id).single(),
    ticket.claimed_by
      ? supabase.from("user_profiles").select("display_name").eq("id", ticket.claimed_by).single()
      : Promise.resolve({ data: null }),
    resolveTicketMessages(supabase, ticketId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/mod/support" className="text-sm text-stone-500 hover:underline">
          ← Back to queue
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{ticket.subject}</h1>
          <Link href={`/mod/players/${ticket.player_id}`} className="text-xs text-stone-500 underline">
            {playerProfile?.display_name ?? "Unknown"}&apos;s history
          </Link>
        </div>
        {ticket.status === "open" ? (
          <TicketClaimButton
            ticketId={ticket.id}
            claimedByName={claimedByProfile?.display_name ?? null}
            isMine={ticket.claimed_by === user.id}
          />
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">
        <TicketThread messages={messages} viewerId={user.id} revealStaffNames={true} />
      </div>

      {ticket.status === "open" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-300 p-5 shadow-sm">
          <StaffReplyForm ticketId={ticket.id} />
          <form action={closeTicket} className="border-t border-amber-100 pt-4 dark:border-stone-800">
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <button
              type="submit"
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
            >
              Close ticket
            </button>
          </form>
        </div>
      ) : (
        <form action={reopenTicket} className="rounded-xl border border-amber-300 p-5 shadow-sm">
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <p className="mb-2 text-sm text-stone-500">This ticket is closed.</p>
          <button
            type="submit"
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Reopen
          </button>
        </form>
      )}
    </div>
  );
}
