"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BuyButton({
  userId,
  listingId,
  priceCoins,
  coinBalance,
}: {
  userId: string;
  listingId: string;
  priceCoins: number;
  coinBalance: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleBuy() {
    setIsPending(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("buy_listing", {
      p_buyer_id: userId,
      p_listing_id: listingId,
    });

    setIsPending(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.status === "unavailable") {
      setMessage(data.reason);
      router.refresh();
      return;
    }

    router.refresh();
  }

  if (message) {
    return <p className="text-xs text-red-600 dark:text-red-400">{message}</p>;
  }

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleBuy}
          disabled={isPending}
          className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          {isPending ? "Buying…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-md border border-amber-300 px-3 py-1.5 text-xs hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  const canAfford = coinBalance >= priceCoins;

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={!canAfford}
      title={canAfford ? undefined : "Not enough coins"}
      className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
    >
      Buy — 🪙 {priceCoins}
    </button>
  );
}
