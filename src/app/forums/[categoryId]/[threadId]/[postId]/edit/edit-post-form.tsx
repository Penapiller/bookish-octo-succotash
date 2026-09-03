"use client";

import { useActionState } from "react";
import { updateForumPost, type ForumFormState } from "../../../../actions";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";

const initialState: ForumFormState = null;

export function EditPostForm({
  categoryId,
  threadId,
  postId,
  defaultBody,
}: {
  categoryId: string;
  threadId: string;
  postId: string;
  defaultBody: string;
}) {
  const [state, formAction, isPending] = useActionState(updateForumPost, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="post_id" value={postId} />

      <BBCodeEditor defaultValue={defaultBody} />

      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
