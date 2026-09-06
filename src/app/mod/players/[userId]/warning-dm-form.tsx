"use client";

import { useActionState, useState } from "react";
import { sendStaffWarning, type SendWarningState } from "../../actions";
import type { CannedStaffMessageRow } from "@/lib/supabase/types";

const initialState: SendWarningState = null;

const CUSTOM_VALUE = "__custom__";

// cannedMessages comes from the admin-managed canned_staff_messages table
// (0029_bans_and_staff_fixes.sql) — this used to be a hardcoded array
// here, but staff wanted to add/edit these without a code change (see
// /admin/canned-messages). Fetched server-side by the page (this is a
// client component, and the RLS-backed select is staff-only) and passed
// down, same pattern as any other server-fetched-then-client-rendered
// list in this app.
export function WarningDmForm({
  targetUserId,
  targetName,
  cannedMessages,
}: {
  targetUserId: string;
  targetName: string;
  cannedMessages: Pick<CannedStaffMessageRow, "label" | "body">[];
}) {
  const [state, formAction, isPending] = useActionState(sendStaffWarning, initialState);
  const [selected, setSelected] = useState<string>(cannedMessages[0]?.body ?? CUSTOM_VALUE);
  const isCustom = selected === CUSTOM_VALUE;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Message {targetName} as staff
      </h2>
      <input type="hidden" name="target_user_id" value={targetUserId} />

      <select
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
      >
        {cannedMessages.map((m) => (
          <option key={m.label} value={m.body}>
            {m.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Write my own…</option>
      </select>

      {isCustom ? (
        <textarea
          name="message"
          rows={4}
          maxLength={4000}
          placeholder="Write a message…"
          required
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
      ) : (
        <>
          <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400">
            {selected}
          </p>
          <input type="hidden" name="message" value={selected} />
        </>
      )}

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
