"use client";

import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { updateThreadFlags, deleteThread } from "../../actions";

/**
 * Staff-only (moderator or admin) pin/lock/delete controls, tucked behind
 * a small icon button in the thread panel's header bar instead of an
 * always-visible strip across the top of every post — matches the
 * "hamburger menu on the thread header" affordance from the original
 * reference mockup. Click-outside-to-close, same pattern as nav-
 * groups.tsx and the BBCode editor's popovers. Was admin-only before
 * 0027_moderation.sql widened pin/lock (and added delete) to moderators.
 */
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Moderation controls"
        title="Moderation controls"
        className={`rounded-md p-1.5 text-white hover:bg-white/15 ${open ? "bg-white/15" : ""}`}
      >
        <Settings size={18} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 flex w-52 flex-col gap-3 rounded-md border border-amber-300 bg-white p-3 text-sm text-stone-700 shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Moderation
          </span>
          <form action={updateThreadFlags} className="flex flex-col gap-3">
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="thread_id" value={threadId} />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_pinned"
                defaultChecked={isPinned}
                className="h-4 w-4 rounded border-amber-300"
              />
              Pinned
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_locked"
                defaultChecked={isLocked}
                className="h-4 w-4 rounded border-amber-300"
              />
              Locked
            </label>
            <button
              type="submit"
              className="self-start rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Save
            </button>
          </form>
          <form
            action={deleteThread}
            className="border-t border-amber-100 pt-3"
            onSubmit={(event) => {
              if (!confirm("Delete this whole thread and all its posts? This can't be undone.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="thread_id" value={threadId} />
            <button
              type="submit"
              className="self-start rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete thread
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
