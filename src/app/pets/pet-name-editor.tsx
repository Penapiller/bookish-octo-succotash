"use client";

import Image from "next/image";
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
          className="w-28 rounded border border-amber-300 px-1.5 py-0.5 text-center text-xs dark:border-stone-700 dark:bg-stone-900"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-xs text-stone-500 hover:underline disabled:opacity-60"
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
            className="text-xs text-stone-500 hover:underline"
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
      className="flex items-center gap-1 text-sm font-medium hover:underline"
    >
      {customName}
      <Image src="/icons/edit-pencil.png" alt="" width={16} height={16} />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1 text-xs italic text-stone-500 hover:underline"
    >
      <Image src="/icons/edit-pencil.png" alt="" width={16} height={16} />
      Name this pet
    </button>
  );
}
