"use client";

import { useActionState } from "react";
import { updateProfile, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = null;

export function SettingsForm({ bio }: { bio: string }) {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
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
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-500">
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
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
