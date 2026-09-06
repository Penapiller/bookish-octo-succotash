"use client";

import { useActionState, useState } from "react";
import { sendQuickQuote, type QuickQuoteState } from "./actions";

const initialState: QuickQuoteState = null;

// Fast path for a board/DM content violation specifically — quotes the
// offending content back to the player plus a short note on which rule it
// broke, sent via the same anonymous Staff-account path as the warning-DM
// tool (sendQuickQuote → send_staff_message). Distinct from WarningDmForm:
// this is for "here's exactly what you posted and why it's a problem,"
// not a general canned/custom warning.
export function QuickQuoteButton({
  targetUserId,
  quotedContent,
}: {
  targetUserId: string;
  quotedContent: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(sendQuickQuote, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-stone-700 dark:text-amber-200 dark:hover:bg-stone-900"
      >
        Quick quote
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-stone-800 dark:bg-stone-950">
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <input type="hidden" name="quoted_content" value={quotedContent} />
      <p className="text-xs text-stone-500">
        Quotes the content below back to the player as a rule-violation notice, from the Staff account.
      </p>
      <p className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs italic text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
        &ldquo;{quotedContent}&rdquo;
      </p>
      <textarea
        name="note"
        rows={2}
        maxLength={500}
        required
        placeholder="Which rule did this violate? (shown to the player)"
        className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          {isPending ? "Sending…" : "Send quote"}
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
