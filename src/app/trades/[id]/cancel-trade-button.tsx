"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CancelTradeButton({ userId, tradeId }: { userId: string; tradeId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_trade", {
      p_user_id: userId,
      p_trade_id: tradeId,
    });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="self-start rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "Cancelling…" : "Cancel this trade"}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
