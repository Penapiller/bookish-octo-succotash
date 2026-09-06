"use client";

import { useActionState } from "react";
import { sendMessage, type SendMessageState } from "./actions";

const initialState: SendMessageState = null;

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, isPending] = useActionState(sendMessage, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <textarea
        name="body"
        rows={5}
        maxLength={4000}
        placeholder="Write a message…"
        required
        className="w-full resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
