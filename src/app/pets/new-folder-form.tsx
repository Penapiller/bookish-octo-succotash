"use client";

import { useActionState, useRef } from "react";
import { createFolder, type FolderFormState } from "./actions";

const initialState: FolderFormState = null;

export function NewFolderForm() {
  const [state, formAction, isPending] = useActionState(createFolder, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex items-end gap-2"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new_folder_name" className="text-xs text-stone-500">
          New folder
        </label>
        <input
          id="new_folder_name"
          name="name"
          placeholder="e.g. Favorites"
          maxLength={60}
          required
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-amber-300 px-3 py-2 text-sm hover:bg-amber-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        {isPending ? "Creating…" : "+ New folder"}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
