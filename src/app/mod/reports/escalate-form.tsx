"use client";

import { useActionState, useState } from "react";
import { escalateReport, type EscalateState } from "../actions";

const initialState: EscalateState = null;

// A moderator's handoff when they've decided a case needs a longer
// restriction or an account ban — which they can't issue themselves
// (bans' hybrid duration cap, 0031_moderation_overhaul.sql). Moves the
// whole ticket into the admin queue instead of trying to talk an admin
// into it out of band.
export function EscalateForm({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(escalateReport, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-stone-700 dark:text-amber-200 dark:hover:bg-stone-900"
      >
        Escalate to Admin
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-stone-800 dark:bg-stone-950">
      <input type="hidden" name="report_id" value={reportId} />
      <label className="text-xs font-medium">Why does this need admin review?</label>
      <textarea
        name="escalation_reason"
        rows={2}
        maxLength={1000}
        required
        placeholder="e.g. Repeated harassment, previous warnings didn't help."
        className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      <label className="text-xs font-medium">Recommended action (optional)</label>
      <input
        type="text"
        name="recommended_action"
        maxLength={200}
        placeholder="e.g. Permanent forums ban"
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          {isPending ? "Escalating…" : "Submit to Admin Queue"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-xs text-stone-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
