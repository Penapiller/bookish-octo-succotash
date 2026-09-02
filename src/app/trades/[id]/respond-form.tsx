"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

export function RespondForm({
  userId,
  tradeId,
  pets,
  inventory,
  coinBalance,
  gemBalance,
}: {
  userId: string;
  tradeId: string;
  pets: PetWithSpecies[];
  inventory: ItemWithQuantity[];
  coinBalance: number;
  gemBalance: number;
}) {
  const router = useRouter();
  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePet(petId: string) {
    setSelectedPetIds((prev) => {
      const next = new Set(prev);
      if (next.has(petId)) {
        next.delete(petId);
      } else {
        next.add(petId);
      }
      return next;
    });
  }

  function setItemQuantity(itemId: string, quantity: number, max: number) {
    const clamped = Math.max(0, Math.min(quantity, max));
    setItemQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  }

  async function respond(accept: boolean) {
    setIsPending(true);
    setError(null);

    const itemIds = Object.entries(itemQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId]) => itemId);
    const itemQtys = itemIds.map((itemId) => itemQuantities[itemId]);

    const supabase = createClient();
    const { error } = await supabase.rpc("respond_to_trade", {
      p_user_id: userId,
      p_trade_id: tradeId,
      p_accept: accept,
      p_pet_ids: accept ? [...selectedPetIds] : [],
      p_item_ids: accept ? itemIds : [],
      p_item_quantities: accept ? itemQtys : [],
      p_coins: accept ? coins : 0,
      p_gems: accept ? gems : 0,
    });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
      <h3 className="text-sm font-semibold">
        Accept and give back (optional — leave empty to accept as a gift)
      </h3>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          🪙
          <input
            type="number"
            min={0}
            max={coinBalance}
            value={coins}
            onChange={(e) => setCoins(Math.max(0, Math.min(Number(e.target.value) || 0, coinBalance)))}
            className="w-24 rounded-md border border-amber-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
          />
          <span className="text-xs text-stone-500">/ {coinBalance}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          💎
          <input
            type="number"
            min={0}
            max={gemBalance}
            value={gems}
            onChange={(e) => setGems(Math.max(0, Math.min(Number(e.target.value) || 0, gemBalance)))}
            className="w-24 rounded-md border border-amber-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
          />
          <span className="text-xs text-stone-500">/ {gemBalance}</span>
        </label>
      </div>

      {pets.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-500">
            Pets ({selectedPetIds.size} selected)
          </span>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {pets.map((pet) => {
              const selected = selectedPetIds.has(pet.id);
              return (
                <li key={pet.id}>
                  <button
                    type="button"
                    onClick={() => togglePet(pet.id)}
                    className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 p-2 text-center ${
                      selected
                        ? "border-amber-800 bg-amber-100 dark:border-amber-200 dark:bg-stone-800"
                        : "border-transparent hover:bg-amber-50 dark:hover:bg-stone-900"
                    }`}
                  >
                    {pet.species?.image_url ? (
                      <Image
                        src={pet.species.image_url}
                        alt={pet.species?.name ?? ""}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded border-2 border-blue-600"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-amber-200 dark:bg-stone-800" />
                    )}
                    <span className="text-xs">{pet.custom_name ?? pet.species?.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {inventory.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-500">Items</span>
          <ul className="flex flex-col gap-2">
            {inventory.map((entry) =>
              entry.item ? (
                <li key={entry.item.id} className="flex items-center gap-3">
                  {entry.item.image_url ? (
                    <Image
                      src={entry.item.image_url}
                      alt={entry.item.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded border-2 border-green-600"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-amber-200 dark:bg-stone-800" />
                  )}
                  <span className="flex-1 text-sm">{entry.item.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={entry.quantity}
                    value={itemQuantities[entry.item.id] ?? 0}
                    onChange={(e) =>
                      setItemQuantity(entry.item!.id, Number(e.target.value) || 0, entry.quantity)
                    }
                    className="w-16 rounded-md border border-amber-300 px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
                  />
                  <span className="text-xs text-stone-500">/ {entry.quantity}</span>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={isPending}
          className="rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          {isPending ? "Working…" : "Accept trade"}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={isPending}
          className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
