"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type InventoryOption = {
  itemId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

// Deploys when an empty plot is clicked — lists the player's seeds (from
// inventory, quantity > 0) and asks which to plant, plus an optional
// fertilizer. A seed that plants "from a pool" vs a specific plant look
// identical here; which plant actually comes up is rolled server-side in
// plant_seed() (see 0035_gardening.sql's seed_plants comment) — this
// modal doesn't need to know or show that distinction up front.
export function PlantSeedModal({
  userId,
  plotIndex,
  seedOptions,
  fertilizerOptions,
  onClose,
}: {
  userId: string;
  plotIndex: number;
  seedOptions: InventoryOption[];
  fertilizerOptions: InventoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [selectedFertilizerId, setSelectedFertilizerId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlant() {
    if (!selectedSeedId) return;
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("plant_seed", {
      p_user_id: userId,
      p_plot_index: plotIndex,
      p_seed_item_id: selectedSeedId,
      p_fertilizer_item_id: selectedFertilizerId,
    });

    setIsPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-amber-800 bg-white p-5 shadow-lg dark:bg-stone-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">What would you like to plant?</h2>

        {seedOptions.length === 0 ? (
          <p className="text-sm italic text-stone-500">You don&apos;t have any seeds. Visit the marketplace or find some on an expedition.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-stone-500">Seed</span>
            <ul className="flex flex-col gap-1.5">
              {seedOptions.map((seed) => (
                <li key={seed.itemId}>
                  <button
                    type="button"
                    onClick={() => setSelectedSeedId(seed.itemId)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      selectedSeedId === seed.itemId
                        ? "border-amber-800 bg-amber-50 dark:border-amber-400 dark:bg-stone-800"
                        : "border-green-300 hover:bg-green-50 dark:border-stone-700 dark:hover:bg-stone-800"
                    }`}
                  >
                    {seed.imageUrl ? (
                      <Image src={seed.imageUrl} alt="" width={28} height={28} className="h-7 w-7 rounded" />
                    ) : null}
                    <span className="flex-1">{seed.name}</span>
                    <span className="text-xs text-stone-500">×{seed.quantity}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fertilizerOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-stone-500">Fertilizer (optional)</span>
            <ul className="flex flex-col gap-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedFertilizerId(null)}
                  className={`flex w-full items-center rounded-md border px-3 py-2 text-left text-sm ${
                    selectedFertilizerId === null
                      ? "border-amber-800 bg-amber-50 dark:border-amber-400 dark:bg-stone-800"
                      : "border-green-300 hover:bg-green-50 dark:border-stone-700 dark:hover:bg-stone-800"
                  }`}
                >
                  None
                </button>
              </li>
              {fertilizerOptions.map((fertilizer) => (
                <li key={fertilizer.itemId}>
                  <button
                    type="button"
                    onClick={() => setSelectedFertilizerId(fertilizer.itemId)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      selectedFertilizerId === fertilizer.itemId
                        ? "border-amber-800 bg-amber-50 dark:border-amber-400 dark:bg-stone-800"
                        : "border-green-300 hover:bg-green-50 dark:border-stone-700 dark:hover:bg-stone-800"
                    }`}
                  >
                    {fertilizer.imageUrl ? (
                      <Image src={fertilizer.imageUrl} alt="" width={28} height={28} className="h-7 w-7 rounded" />
                    ) : null}
                    <span className="flex-1">{fertilizer.name}</span>
                    <span className="text-xs text-stone-500">×{fertilizer.quantity}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePlant}
            disabled={!selectedSeedId || isPending}
            className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            {isPending ? "Planting…" : "Plant"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
