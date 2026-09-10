"use client";

import { useActionState } from "react";
import { createForumThread, type ForumFormState } from "../../actions";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";

const initialState: ForumFormState = null;

export function NewThreadForm({ categoryId }: { categoryId: string }) {
  const [state, formAction, isPending] = useActionState(createForumThread, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="category_id" value={categoryId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          className="rounded-md border border-green-300 px-4 py-2.5 text-base dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <BBCodeEditor />

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Posting…" : "Start thread"}
      </button>
    </form>
  );
}
