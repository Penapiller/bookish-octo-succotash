"use client";

import { useActionState } from "react";
import { sendTicketMessage, type SendTicketMessageState } from "../actions";

const initialState: SendTicketMessageState = null;

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, isPending] = useActionState(sendTicketMessage, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <textarea
        name="body"
        rows={3}
        maxLength={4000}
        required
        placeholder="Type your reply…"
        className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
