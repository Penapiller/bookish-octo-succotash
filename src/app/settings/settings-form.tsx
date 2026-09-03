"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { updateProfile, removeAvatar, type SettingsFormState } from "./actions";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";

const initialState: SettingsFormState = null;
// Keep in sync with MAX_BIO_LENGTH in ./actions.ts — that's the real
// limit (enforced server-side); this is just so the textarea stops the
// player before they type past it.
const MAX_BIO_LENGTH = 2000;

export function SettingsForm({
  bio,
  avatarUrl,
}: {
  bio: string;
  avatarUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState,
  );
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Profile picture</label>
        <div className="flex items-center gap-4">
          {preview ?? avatarUrl ? (
            <Image
              src={preview ?? avatarUrl!}
              alt=""
              width={72}
              height={72}
              unoptimized={preview !== null}
              className="h-[72px] w-[72px] rounded-full border border-amber-200 object-cover dark:border-stone-800"
            />
          ) : (
            <div className="h-[72px] w-[72px] rounded-full border border-amber-200 bg-amber-100 dark:border-stone-800 dark:bg-stone-800" />
          )}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              name="avatar"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm"
            />
            {avatarUrl ? (
              <button
                type="submit"
                formAction={removeAvatar}
                className="self-start text-xs text-stone-500 underline hover:text-stone-700 dark:hover:text-stone-300"
              >
                Remove profile picture
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-stone-500">PNG, JPEG, WebP, or GIF. Up to 2 MB.</p>
      </div>

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
