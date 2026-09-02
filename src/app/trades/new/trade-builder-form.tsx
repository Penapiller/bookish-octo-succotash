"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

export function TradeBuilderForm({
  userId,
  initialRecipientName,
  pets,
  inventory,
  coinBalance,
  gemBalance,
}: {
  userId: string;
  initialRecipientName: string;
  pets: PetWithSpecies[];
  inventory: ItemWithQuantity[];
  coinBalance: number;
  gemBalance: number;
}) {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);
  const [note, setNote] = useState("");
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

  async function handleSubmit() {
    setError(null);

    const name = recipientName.trim();
    if (name.length === 0) {
      setError("Enter the username of who you want to trade with.");
      return;
    }

    const itemIds = Object.entries(itemQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId]) => itemId);
    const itemQtys = itemIds.map((itemId) => itemQuantities[itemId]);

    if (selectedPetIds.size === 0 && itemIds.length === 0 && coins === 0 && gems === 0) {
      setError("Offer at least one pet, item, coin, or gem.");
      return;
    }

    setIsPending(true);
    const supabase = createClient();

    const { data: profile, error: lookupError } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("display_name", name)
      .maybeSingle();

    if (lookupError || !profile) {
      setIsPending(false);
      setError(`No player found named "${name}".`);
      return;
    }

    if (profile.id === userId) {
      setIsPending(false);
      setError("You can't trade with yourself.");
      return;
    }

    const { data: tradeId, error: rpcError } = await supabase.rpc("create_trade", {
      p_initiator_id: userId,
      p_recipient_id: profile.id,
      p_pet_ids: [...selectedPetIds],
      p_item_ids: itemIds,
      p_item_quantities: itemQtys,
      p_coins: coins,
      p_gems: gems,
      p_note: note.trim() || null,
    });

    setIsPending(false);

    if (rpcError || !tradeId) {
      setError(rpcError?.message ?? "Could not create the trade.");
      return;
    }

    router.push(`/trades/${tradeId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="recipient" className="text-sm font-medium">
          Trade with (username)
        </label>
        <input
          id="recipient"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Their display name"
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Coins &amp; gems to offer</span>
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
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Pets to offer ({selectedPetIds.size} selected)</span>
        {pets.length === 0 ? (
          <p className="text-sm italic text-stone-500">You don&apos;t have any pets.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
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
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded border-2 border-blue-600"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded bg-amber-200 dark:bg-stone-800" />
                    )}
                    <span className="text-xs">{pet.custom_name ?? pet.species?.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Items to offer</span>
        {inventory.length === 0 ? (
          <p className="text-sm italic text-stone-500">You don&apos;t have any items.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {inventory.map((entry) =>
              entry.item ? (
                <li key={entry.item.id} className="flex items-center gap-3">
                  {entry.item.image_url ? (
                    <Image
                      src={entry.item.image_url}
                      alt={entry.item.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded border-2 border-green-600"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-amber-200 dark:bg-stone-800" />
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
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Note (optional) — what are you hoping to get back?
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="e.g. Looking for a rare pet or coins"
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Sending…" : "Send trade offer"}
      </button>
    </div>
  );
}
