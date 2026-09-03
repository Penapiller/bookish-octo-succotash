"use client";

import { updateThreadFlags } from "../../actions";

export function ThreadAdminControls({
  categoryId,
  threadId,
  isPinned,
  isLocked,
}: {
  categoryId: string;
  threadId: string;
  isPinned: boolean;
  isLocked: boolean;
}) {
  return (
    <form
      action={updateThreadFlags}
      className="flex flex-wrap items-center gap-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
    >
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <span className="font-medium text-stone-500">Admin:</span>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          name="is_pinned"
          defaultChecked={isPinned}
          className="h-4 w-4 rounded border-amber-300 dark:border-stone-700"
        />
        Pinned
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          name="is_locked"
          defaultChecked={isLocked}
          className="h-4 w-4 rounded border-amber-300 dark:border-stone-700"
        />
        Locked
      </label>
      <button
        type="submit"
        className="rounded-md bg-amber-800 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        Save
      </button>
    </form>
  );
}
