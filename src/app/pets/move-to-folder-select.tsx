"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const UNSORTED_VALUE = "__unsorted__";

export function MoveToFolderSelect({
  userId,
  petId,
  currentFolderId,
  folders,
}: {
  userId: string;
  petId: string;
  currentFolderId: string | null;
  folders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const folderId = value === UNSORTED_VALUE ? null : value;

    setIsPending(true);
    const supabase = createClient();
    await supabase.rpc("move_pet_to_folder", {
      p_user_id: userId,
      p_pet_id: petId,
      p_folder_id: folderId,
    });
    setIsPending(false);
    router.refresh();
  }

  return (
    <select
      value={currentFolderId ?? UNSORTED_VALUE}
      onChange={handleChange}
      disabled={isPending}
      className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <option value={UNSORTED_VALUE}>Unsorted</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </select>
  );
}
