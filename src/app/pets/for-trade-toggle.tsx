"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ForTradeToggle({
  userId,
  petId,
  isForTrade,
}: {
  userId: string;
  petId: string;
  isForTrade: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);

    const supabase = createClient();
    await supabase.rpc("set_pet_for_trade", {
      p_user_id: userId,
      p_pet_id: petId,
      p_is_for_trade: !isForTrade,
    });

    setIsPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-60 ${
        isForTrade
          ? "bg-amber-800 text-white dark:bg-amber-200 dark:text-amber-950"
          : "border border-amber-300 text-stone-500 hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-800"
      }`}
    >
      {isForTrade ? "For trade" : "Mark for trade"}
    </button>
  );
}
