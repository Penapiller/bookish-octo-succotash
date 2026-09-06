"use client";

import { useActionState } from "react";
import { createTicket, type CreateTicketState } from "../actions";

const initialState: CreateTicketState = null;

export function NewTicketForm() {
  const [state, formAction, isPending] = useActionState(createTicket, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="subject" className="text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          required
          maxLength={200}
          placeholder="What's this about?"
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          required
          maxLength={4000}
          placeholder="Tell us what's going on."
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}
