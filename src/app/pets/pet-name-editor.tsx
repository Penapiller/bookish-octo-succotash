"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PetNameEditor({
  userId,
  petId,
  customName,
}: {
  userId: string;
  petId: string;
  customName: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(customName ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("rename_pet", {
      p_user_id: userId,
      p_pet_id: petId,
      p_name: value,
    });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    setIsEditing(false);
    router.refresh();
  }

  if (isEditing) {
    return (
      <div className="flex flex-col items-center gap-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          autoFocus
          placeholder="Pet name"
          className="w-28 rounded border border-zinc-300 px-1.5 py-0.5 text-center text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-xs text-zinc-500 hover:underline disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setValue(customName ?? "");
              setError(null);
            }}
            className="text-xs text-zinc-500 hover:underline"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    );
  }

  return customName ? (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="text-sm font-medium hover:underline"
    >
      {customName}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="text-xs italic text-zinc-500 hover:underline"
    >
      + Name this pet
    </button>
  );
}
