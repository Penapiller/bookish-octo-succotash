import { AddNoteForm } from "./add-note-form";
import type { ReportNoteWithAuthor } from "@/lib/supabase/types";

// Internal staff-only handoff log for a ticket — never shown to players,
// and separate from resolution_note (the one-line "why this was closed"
// written at resolve/dismiss time). No author-anonymity here since it's
// staff talking to staff.
export function NoteThread({ notes, reportId }: { notes: ReportNoteWithAuthor[]; reportId: string }) {
  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <p className="text-sm italic text-stone-500">No internal notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-stone-500">
                {note.authorName} — {new Date(note.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      <AddNoteForm reportId={reportId} />
    </div>
  );
}
