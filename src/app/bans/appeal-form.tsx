"use client";

import { useActionState, useState } from "react";
import { submitAppeal, type SubmitAppealState } from "./actions";

const initialState: SubmitAppealState = null;

export function AppealForm({ banId }: { banId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitAppeal, initialState);

  if (state && !state.error) {
    return <p className="text-xs italic text-stone-500">Appeal submitted — a staff member will review it.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        Appeal this action
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="ban_id" value={banId} />
      <textarea
        name="reason"
        rows={3}
        maxLength={1000}
        required
        placeholder="Why do you think this was a mistake?"
        className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          {isPending ? "Submitting…" : "Submit appeal"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-stone-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
