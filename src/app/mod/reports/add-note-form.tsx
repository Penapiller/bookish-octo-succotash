"use client";

import { useActionState } from "react";
import { addReportNote, type AddNoteState } from "../actions";

const initialState: AddNoteState = null;

export function AddNoteForm({ reportId }: { reportId: string }) {
  const [state, formAction, isPending] = useActionState(addReportNote, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="report_id" value={reportId} />
      <textarea
        name="body"
        rows={2}
        maxLength={2000}
        required
        placeholder="Leave a note for the team (staff-only, never shown to players)…"
        className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        {isPending ? "Adding…" : "Add note"}
      </button>
    </form>
  );
}
