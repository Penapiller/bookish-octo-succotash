"use client";

import { useActionState, useState } from "react";
import { handleReport, escalateReportSimple, type HandleReportState, type ReportHandling } from "../actions";

const initialState: HandleReportState = null;

const HANDLING_OPTIONS: { value: ReportHandling; label: string }[] = [
  { value: "dismiss", label: "Nothing / Dismiss" },
  { value: "warn", label: "Verbal Warning" },
  { value: "forums_ban", label: "Forums Ban" },
  { value: "dm_ban", label: "DMs Ban" },
  { value: "sales_ban", label: "Sales Ban" },
];

const DURATION_OPTIONS: { label: string; hours: number }[] = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 24 * 3 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
];

// The whole "handle this report" panel — a message box, a row of
// handling-choice buttons, and (only once a choice has been made) a
// bottom action bar with two independent forms: Confirm & Send (sends
// the message via handleReport, applying a ban if the choice calls for
// one, and always closes the report) and Escalate to Admin
// (escalateReportSimple — never sends a message, never closes, just
// flags the report for an admin). Two sibling <form>s rather than one,
// since HTML forms can't nest and each needs its own action.
export function ReportHandlingForm({ reportId }: { reportId: string }) {
  const [state, formAction, isPending] = useActionState(handleReport, initialState);
  const [handling, setHandling] = useState<ReportHandling | null>(null);
  const [message, setMessage] = useState("");

  const needsMessage = handling !== null && handling !== "dismiss";
  const isBanHandling = handling === "forums_ban" || handling === "dm_ban" || handling === "sales_ban";
  const canConfirm = handling !== null && (!needsMessage || message.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="handling-message" className="text-sm font-medium">
          Message to player {needsMessage ? "" : "(optional unless you dismiss)"}
        </label>
        <textarea
          id="handling-message"
          rows={5}
          maxLength={4000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Let them know what's going on…"
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">How should this be handled?</span>
        <div className="flex flex-wrap gap-2">
          {HANDLING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setHandling(opt.value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                handling === opt.value
                  ? "border-amber-800 bg-amber-800 text-white dark:border-amber-200 dark:bg-amber-200 dark:text-amber-950"
                  : "border-amber-300 hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isBanHandling ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="duration_hours" className="text-sm font-medium">
            Ban duration
          </label>
          <select
            id="duration_hours"
            form="report-handling-confirm-form"
            name="duration_hours"
            defaultValue={72}
            className="w-40 rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      {handling !== null ? (
        <div className="flex flex-wrap gap-2 border-t border-amber-200 pt-4 dark:border-stone-800">
          <form id="report-handling-confirm-form" action={formAction}>
            <input type="hidden" name="report_id" value={reportId} />
            <input type="hidden" name="handling" value={handling} />
            <input type="hidden" name="message" value={message} />
            <button
              type="submit"
              disabled={isPending || !canConfirm}
              className="rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
            >
              {isPending ? "Sending…" : "Confirm and Send"}
            </button>
          </form>
          <form action={escalateReportSimple}>
            <input type="hidden" name="report_id" value={reportId} />
            <button
              type="submit"
              className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
            >
              Escalate to Admin
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
