"use client";

import { useActionState } from "react";
import { createForumReply, type ForumFormState } from "../../actions";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";

const initialState: ForumFormState = null;

export function ReplyForm({ categoryId, threadId }: { categoryId: string; threadId: string }) {
  const [state, formAction, isPending] = useActionState(createForumReply, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />

      <BBCodeEditor />

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Posting…" : "Reply"}
      </button>
    </form>
  );
}
