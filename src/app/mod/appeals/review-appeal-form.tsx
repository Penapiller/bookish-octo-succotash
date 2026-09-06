"use client";

import { useState } from "react";
import { approveAppeal, denyAppeal } from "../actions";

// Both actions rely on appeals' UPDATE policy to reject a staff member
// reviewing their own issued ban's appeal — this form is only ever
// rendered when the viewer isn't that person to begin with (see
// /mod/appeals/page.tsx), so it doesn't need its own client-side check.
export function ReviewAppealForm({ appealId, banId }: { appealId: string; banId: string }) {
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Review note (optional, staff-only)"
        className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      <div className="flex gap-2">
        <form action={approveAppeal}>
          <input type="hidden" name="appeal_id" value={appealId} />
          <input type="hidden" name="ban_id" value={banId} />
          <input type="hidden" name="review_note" value={note} />
          <button
            type="submit"
            className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
          >
            Approve — lift ban
          </button>
        </form>
        <form action={denyAppeal}>
          <input type="hidden" name="appeal_id" value={appealId} />
          <input type="hidden" name="review_note" value={note} />
          <button
            type="submit"
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Deny
          </button>
        </form>
      </div>
    </div>
  );
}
