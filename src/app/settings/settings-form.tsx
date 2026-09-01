"use client";

import { useActionState } from "react";
import { updateProfile, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = null;

export function SettingsForm({
  displayName,
  bio,
}: {
  displayName: string;
  bio: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="display_name" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={displayName}
          maxLength={40}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio}
          maxLength={500}
          rows={5}
          placeholder="Tell other players about yourself…"
          className="resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="text-xs text-zinc-500">
          Plain text only for now — custom profile styling is coming in a
          later update.
        </p>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
