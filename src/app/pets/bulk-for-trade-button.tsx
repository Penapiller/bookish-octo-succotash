"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Bulk-tag every pet in one folder (or Unsorted, when folderId is null)
// as for-trade or not-for-trade at once — the "pet groups that are for
// trade" convenience, so a player doesn't have to toggle each pet one at
// a time when they want to open up a whole lair to trading.
export function BulkForTradeButton({
  userId,
  folderId,
  isForTrade,
}: {
  userId: string;
  folderId: string | null;
  isForTrade: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);

    const supabase = createClient();
    await supabase.rpc("set_folder_pets_for_trade", {
      p_user_id: userId,
      p_folder_id: folderId,
      p_is_for_trade: isForTrade,
    });

    setIsPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md border border-amber-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-amber-100 disabled:opacity-60 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      {isPending
        ? "Working…"
        : isForTrade
          ? "Mark all in this group for trade"
          : "Unmark all in this group"}
    </button>
  );
}
