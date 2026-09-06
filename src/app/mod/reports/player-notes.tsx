"use client";

import { useActionState } from "react";
import { addPlayerNote, type AddPlayerNoteState } from "../actions";
import type { PlayerNoteWithAuthor } from "@/lib/supabase/types";

const initialState: AddPlayerNoteState = null;

// Private, staff-only notes about a PLAYER (not this specific report) —
// dated and attributed to whoever wrote them, so a mod picking up a case
// can see at a glance whether this player has caused trouble before.
export function PlayerNotes({
  userId,
  reportId,
  notes,
}: {
  userId: string;
  reportId: string;
  notes: PlayerNoteWithAuthor[];
}) {
  const [state, formAction, isPending] = useActionState(addPlayerNote, initialState);

  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <p className="text-sm italic text-stone-500">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-stone-200 bg-stone-50 p-2.5 text-sm dark:border-stone-800 dark:bg-stone-950">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-stone-500">
                {note.authorName} — {new Date(note.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="report_id" value={reportId} />
        <textarea
          name="body"
          rows={2}
          maxLength={2000}
          placeholder="Add a note about this player (staff-only)…"
          className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
        {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
        >
          {isPending ? "Adding…" : "Add note"}
        </button>
      </form>
    </div>
  );
}
