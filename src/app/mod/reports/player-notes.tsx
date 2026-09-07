"use client";

import { useActionState, useState } from "react";
import {
  addPlayerNote,
  updatePlayerNote,
  type AddPlayerNoteState,
  type UpdatePlayerNoteState,
} from "../actions";
import type { PlayerNoteWithAuthor } from "@/lib/supabase/types";

const initialAddState: AddPlayerNoteState = null;
const initialEditState: UpdatePlayerNoteState = null;

// Private, staff-only notes about a PLAYER (not this specific report) —
// dated and attributed to whoever wrote them, so a mod picking up a case
// can see at a glance whether this player has caused trouble before. The
// author (only — enforced by RLS, "Authors can edit their own player
// notes", 0033_claiming_and_note_edits.sql) can go back and fix one.
export function PlayerNotes({
  userId,
  reportId,
  notes,
  currentUserId,
}: {
  userId: string;
  reportId: string;
  notes: PlayerNoteWithAuthor[];
  currentUserId: string;
}) {
  const [addState, addAction, isAddPending] = useActionState(addPlayerNote, initialAddState);
  const [editState, editAction, isEditPending] = useActionState(updatePlayerNote, initialEditState);
  const [editingId, setEditingId] = useState<string | null>(null);

  // "Adjust state when related state changes" during render (not in an
  // effect, per React's own guidance) — closing the edit form belongs to
  // the render that first sees a NEW { success: true }, not to a
  // useEffect, which would also fire the instant a note is opened for
  // editing, before the form is ever submitted.
  const [lastHandledEditState, setLastHandledEditState] = useState(editState);
  if (editState !== lastHandledEditState) {
    setLastHandledEditState(editState);
    if (editState && "success" in editState) {
      setEditingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <p className="text-sm italic text-stone-500">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) =>
            editingId === note.id ? (
              <li
                key={note.id}
                className="rounded-md border border-amber-300 bg-stone-50 p-2.5 text-sm dark:border-stone-700 dark:bg-stone-950"
              >
                <form action={editAction} className="flex flex-col gap-2">
                  <input type="hidden" name="note_id" value={note.id} />
                  <input type="hidden" name="user_id" value={userId} />
                  <input type="hidden" name="report_id" value={reportId} />
                  <textarea
                    name="body"
                    rows={2}
                    maxLength={2000}
                    defaultValue={note.body}
                    className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
                  />
                  {editState && "error" in editState ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{editState.error}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isEditPending}
                      className="self-start rounded-md border border-amber-300 px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
                    >
                      {isEditPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="self-start rounded-md px-3 py-1 text-xs text-stone-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li
                key={note.id}
                className="rounded-md border border-stone-200 bg-stone-50 p-2.5 text-sm dark:border-stone-800 dark:bg-stone-950"
              >
                <p className="whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span>
                    {note.authorName} — {new Date(note.created_at).toLocaleDateString()}
                    {note.edited_at ? " (edited)" : ""}
                  </span>
                  {note.authorId === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => setEditingId(note.id)}
                      className="text-amber-800 underline hover:no-underline dark:text-amber-400"
                    >
                      Edit
                    </button>
                  ) : null}
                </p>
              </li>
            ),
          )}
        </ul>
      )}
      <form action={addAction} className="flex flex-col gap-2">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="report_id" value={reportId} />
        <textarea
          name="body"
          rows={2}
          maxLength={2000}
          placeholder="Add a note about this player (staff-only)…"
          className="resize-y rounded-md border border-amber-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
        {addState?.error ? <p className="text-xs text-red-600 dark:text-red-400">{addState.error}</p> : null}
        <button
          type="submit"
          disabled={isAddPending}
          className="self-start rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
        >
          {isAddPending ? "Adding…" : "Add note"}
        </button>
      </form>
    </div>
  );
}
