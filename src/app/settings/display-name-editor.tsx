"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAME_CHANGE_COST_GEMS = 15;

export function DisplayNameEditor({
  userId,
  displayName,
  gemBalance,
  nextChangeAvailableAt,
}: {
  userId: string;
  displayName: string;
  gemBalance: number;
  nextChangeAvailableAt: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(displayName);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChangeNow = new Date() >= new Date(nextChangeAvailableAt);
  const nextAvailableLabel = new Date(nextChangeAvailableAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" },
  );

  async function handleSave() {
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("change_display_name", {
      p_user_id: userId,
      p_new_name: value,
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
      <div className="flex flex-col gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minLength={3}
          maxLength={40}
          autoFocus
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-xs text-stone-500 hover:underline disabled:opacity-60"
          >
            {isPending ? "Saving…" : `Save (spends ${NAME_CHANGE_COST_GEMS} gems)`}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setValue(displayName);
              setError(null);
            }}
            className="text-xs text-stone-500 hover:underline"
          >
            Cancel
          </button>
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{displayName}</p>
      {canChangeNow ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={gemBalance < NAME_CHANGE_COST_GEMS}
          className="self-start text-xs text-stone-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          Change name ({NAME_CHANGE_COST_GEMS} gems)
        </button>
      ) : (
        <p className="text-xs text-stone-500">
          You can change your name again on {nextAvailableLabel}.
        </p>
      )}
      {canChangeNow && gemBalance < NAME_CHANGE_COST_GEMS ? (
        <p className="text-xs text-stone-500">
          You need {NAME_CHANGE_COST_GEMS} gems to change your name — you have{" "}
          {gemBalance}.
        </p>
      ) : null}
    </div>
  );
}
