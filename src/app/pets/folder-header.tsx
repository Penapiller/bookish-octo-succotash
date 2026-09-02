"use client";

import { useActionState, useState } from "react";
import { renameFolder, deleteFolder, type FolderFormState } from "./actions";

const initialState: FolderFormState = null;

export function FolderHeader({
  folderId,
  name,
  petCount,
}: {
  folderId: string;
  name: string;
  petCount: number;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [state, formAction, isPending] = useActionState(renameFolder, initialState);

  if (isRenaming) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <form action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="folder_id" value={folderId} />
          <input
            name="name"
            defaultValue={name}
            autoFocus
            maxLength={60}
            required
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs text-zinc-500 hover:underline disabled:opacity-60"
          >
            Save
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsRenaming(false)}
          className="text-xs text-zinc-500 hover:underline"
        >
          Cancel
        </button>
        {state?.error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <h2 className="text-lg font-semibold tracking-tight">
        {name} ({petCount})
      </h2>
      <button
        type="button"
        onClick={() => setIsRenaming(true)}
        className="text-xs text-zinc-500 hover:underline"
      >
        Rename
      </button>
      <form action={deleteFolder}>
        <input type="hidden" name="folder_id" value={folderId} />
        <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
          Delete
        </button>
      </form>
    </div>
  );
}
