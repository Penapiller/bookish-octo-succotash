"use client";

import { useActionState } from "react";
import { startConversationWithName, type StartConversationState } from "./actions";

const initialState: StartConversationState = null;

export function NewMessageForm() {
  const [state, formAction, isPending] = useActionState(startConversationWithName, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="display_name" className="text-xs font-medium text-stone-500">
          Message a player
        </label>
        <input
          id="display_name"
          name="display_name"
          placeholder="Their username"
          className="rounded-md border border-amber-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-amber-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Finding…" : "Start"}
      </button>
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
    </form>
  );
}
