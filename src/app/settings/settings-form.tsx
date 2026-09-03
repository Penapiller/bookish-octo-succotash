"use client";

import { useActionState } from "react";
import { updateProfile, type SettingsFormState } from "./actions";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";

const initialState: SettingsFormState = null;
// Keep in sync with MAX_BIO_LENGTH in ./actions.ts — that's the real
// limit (enforced server-side); this is just so the textarea stops the
// player before they type past it.
const MAX_BIO_LENGTH = 2000;

export function SettingsForm({ bio }: { bio: string }) {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Bio</label>
        {/* Same editor and BBCode pipeline as the forums (src/lib/bbcode.ts)
            — bbcodeToHtml() re-renders this from scratch on every profile
            page view rather than storing a precomputed body_html, so
            there's no separate raw/rendered pair to keep in sync. */}
        <BBCodeEditor name="bio" defaultValue={bio} rows={6} maxLength={MAX_BIO_LENGTH} />
        <p className="text-xs text-stone-500">
          Supports the same BBCode formatting as forum posts — bold, colors, fonts, and more.
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
