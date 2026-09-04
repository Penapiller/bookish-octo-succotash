"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { submitReport, type ReportFormState } from "@/lib/report-actions";
import type { ReportTargetType } from "@/lib/supabase/types";

const initialState: ReportFormState = null;

const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  scam: "Scamming",
  other: "Other",
};

/**
 * Shared by /u/[id] (target_type "user") and the forums' PostCard
 * (target_type "forum_post") — same toggle-to-reveal-a-form pattern as
 * ReplyToggle (src/app/forums/[categoryId]/[threadId]/reply-toggle.tsx),
 * so the report form doesn't take up space until someone actually wants
 * to use it.
 */
export function ReportButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitReport, initialState);

  if (state && "success" in state) {
    return <p className="text-sm text-stone-500">Report submitted. Thanks for flagging this.</p>;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Flag size={14} />
        {label}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-2 rounded-md border border-red-200 p-3 dark:border-red-900"
    >
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <label className="text-xs font-medium">Reason</label>
      <select
        name="category"
        required
        defaultValue=""
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
      >
        <option value="" disabled>
          Select a reason…
        </option>
        {Object.entries(CATEGORY_LABELS).map(([value, categoryLabel]) => (
          <option key={value} value={value}>
            {categoryLabel}
          </option>
        ))}
      </select>
      <textarea
        name="details"
        rows={3}
        maxLength={1000}
        placeholder="Any extra details (optional)"
        className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Submitting…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-md border border-amber-300 px-3 py-1.5 text-xs hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
