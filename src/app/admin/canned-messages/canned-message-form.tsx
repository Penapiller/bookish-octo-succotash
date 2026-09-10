"use client";

import { useActionState } from "react";
import type { CannedMessageFormState } from "./actions";
import type { CannedStaffMessageRow } from "@/lib/supabase/types";

const initialState: CannedMessageFormState = null;

export function CannedMessageForm({
  action,
  message,
  submitLabel,
}: {
  action: (prevState: CannedMessageFormState, formData: FormData) => Promise<CannedMessageFormState>;
  message?: CannedStaffMessageRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {message ? <input type="hidden" name="message_id" value={message.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="label" className="text-sm font-medium">
          Label
        </label>
        <input
          id="label"
          name="label"
          defaultValue={message?.label ?? ""}
          required
          maxLength={100}
          placeholder="Shown in the staff dropdown, e.g. 'Content removed'"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">
          Message body
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          maxLength={4000}
          defaultValue={message?.body ?? ""}
          required
          placeholder="Sent to the player exactly as written."
          className="resize-y rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sort_order" className="text-sm font-medium">
          Sort order
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          defaultValue={message?.sort_order ?? 0}
          className="w-24 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-500">Lower numbers appear first in the staff dropdown.</p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={message?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active (visible in the staff dropdown)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
