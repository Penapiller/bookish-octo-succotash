import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTicketMessages } from "../resolve-support";
import { TicketThread } from "../ticket-thread";
import { ReplyForm } from "./reply-form";

export default async function SupportTicketPage(props: PageProps<"/support/[ticketId]">) {
  const { ticketId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, player_id, subject, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || ticket.player_id !== user.id) {
    notFound();
  }

  const messages = await resolveTicketMessages(supabase, ticketId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-12">
      <div>
        <Link href="/support" className="text-sm text-stone-500 hover:underline">
          ← Back to my tickets
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
      </div>

      <div className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">
        <TicketThread messages={messages} viewerId={user.id} revealStaffNames={false} />
      </div>

      {ticket.status === "open" ? (
        <div className="rounded-xl border border-amber-300 p-5 shadow-sm">
          <ReplyForm ticketId={ticket.id} />
        </div>
      ) : (
        <p className="rounded-xl border border-amber-300 p-5 text-sm text-stone-500 shadow-sm">
          This ticket is closed. If you need anything else, open a new one.
        </p>
      )}
    </main>
  );
}
