"use client";

import { useActionState } from "react";
import { issueBan, type IssueBanState } from "../../actions";
import type { BanType } from "@/lib/supabase/types";

const initialState: IssueBanState = null;

const BAN_TYPE_LABELS: Record<BanType, string> = {
  dm: "DM ban — can't message other players (or be messaged by them)",
  sales: "Sales ban — can't create new marketplace listings",
  forums: "Forums ban — can't post to the forums",
  account: "Account ban — can't log in at all",
};

const DURATION_OPTIONS: { label: string; hours: number }[] = [
  { label: "1 hour", hours: 1 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 24 * 3 },
  { label: "7 days", hours: 24 * 7 },
  { label: "14 days", hours: 24 * 14 },
  { label: "30 days", hours: 24 * 30 },
  { label: "90 days", hours: 24 * 90 },
  { label: "1 year", hours: 24 * 365 },
];

// isAdmin gates whether "account" even shows up as an option — a
// moderator who isn't also an admin submitting it anyway would just hit
// bans' admin-only INSERT policy for that type and get issueBan's
// friendly rejection message, but hiding it here means they never see
// the option in the first place.
export function BanForm({ targetUserId, isAdmin }: { targetUserId: string; isAdmin: boolean }) {
  const [state, formAction, isPending] = useActionState(issueBan, initialState);
  const banTypes: BanType[] = isAdmin ? ["dm", "sales", "forums", "account"] : ["dm", "sales", "forums"];

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Issue a ban</h2>
      <input type="hidden" name="target_user_id" value={targetUserId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ban_type" className="text-sm font-medium">
          Ban type
        </label>
        <select
          id="ban_type"
          name="ban_type"
          className="rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
        >
          {banTypes.map((t) => (
            <option key={t} value={t}>
              {BAN_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="duration_hours" className="text-sm font-medium">
          Duration
        </label>
        <select
          id="duration_hours"
          name="duration_hours"
          defaultValue={24}
          className="rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
        >
          {DURATION_OPTIONS.map((d) => (
            <option key={d.hours} value={d.hours}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-sm font-medium">
          Reason (staff-only, not shown to the player)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          maxLength={500}
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
      </div>

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 dark:bg-red-900 dark:hover:bg-red-800"
      >
        {isPending ? "Issuing…" : "Issue ban"}
      </button>
    </form>
  );
}
