"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PetPickerModal, ItemPickerModal, type PickerPet, type PickerItem } from "@/components/picker-modal";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

function toPickerPets(pets: PetWithSpecies[]): PickerPet[] {
  return pets.map((p) => ({
    id: p.id,
    name: p.custom_name ?? p.species?.name ?? "Unknown pet",
    imageUrl: p.species?.image_url ?? null,
    rarity: p.rarity,
  }));
}

function toPickerItems(inventory: ItemWithQuantity[]): PickerItem[] {
  return inventory
    .filter((entry) => entry.item)
    .map((entry) => ({
      id: entry.item!.id,
      name: entry.item!.name,
      imageUrl: entry.item!.image_url,
      rarity: entry.item!.rarity,
      maxQuantity: entry.quantity,
    }));
}

export function SellForm({
  userId,
  pets,
  inventory,
}: {
  userId: string;
  pets: PetWithSpecies[];
  inventory: ItemWithQuantity[];
}) {
  const router = useRouter();
  const pickerPets = toPickerPets(pets);
  const pickerItems = toPickerItems(inventory);

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemQty, setSelectedItemQty] = useState(0);
  const [price, setPrice] = useState(0);
  const [modalOpen, setModalOpen] = useState<"pets" | "items" | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPet = selectedPetId ? pickerPets.find((p) => p.id === selectedPetId) : null;
  const selectedItem = selectedItemId ? pickerItems.find((i) => i.id === selectedItemId) : null;

  function choosePet(id: string) {
    setSelectedItemId(null);
    setSelectedItemQty(0);
    setSelectedPetId((prev) => (prev === id ? null : id));
  }

  function chooseItemQuantity(id: string, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(qty, max));
    setSelectedPetId(null);
    if (clamped === 0) {
      setSelectedItemId(null);
      setSelectedItemQty(0);
    } else {
      setSelectedItemId(id);
      setSelectedItemQty(clamped);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (price <= 0) {
      setError("Set a price of at least 1 coin.");
      return;
    }
    if (!selectedPetId && !selectedItemId) {
      setError("Choose a pet or an item to sell first.");
      return;
    }

    setIsPending(true);
    const supabase = createClient();

    const { data: listingId, error: rpcError } = selectedPetId
      ? await supabase.rpc("create_pet_listing", {
          p_seller_id: userId,
          p_pet_id: selectedPetId,
          p_price_coins: price,
        })
      : await supabase.rpc("create_item_listing", {
          p_seller_id: userId,
          p_item_id: selectedItemId!,
          p_quantity: selectedItemQty,
          p_price_coins: price,
        });

    setIsPending(false);

    if (rpcError || !listingId) {
      setError(rpcError?.message ?? "Could not create the listing.");
      return;
    }

    router.push("/marketplace/mine");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">What are you selling?</span>
        {selectedPet ? (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 p-3 dark:border-stone-700">
            {selectedPet.imageUrl ? (
              <Image src={selectedPet.imageUrl} alt="" width={48} height={48} className="h-12 w-12 rounded border-2 border-blue-600" />
            ) : null}
            <span className="flex-1 text-sm">{selectedPet.name}</span>
            <button type="button" onClick={() => setSelectedPetId(null)} className="text-sm text-stone-500 hover:text-red-600">
              Remove
            </button>
          </div>
        ) : selectedItem ? (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 p-3 dark:border-stone-700">
            {selectedItem.imageUrl ? (
              <Image src={selectedItem.imageUrl} alt="" width={48} height={48} className="h-12 w-12 rounded border-2 border-green-600" />
            ) : null}
            <span className="flex-1 text-sm">
              {selectedItem.name} × {selectedItemQty}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedItemId(null);
                setSelectedItemQty(0);
              }}
              className="text-sm text-stone-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm italic text-stone-500">Nothing chosen yet.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalOpen("pets")}
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Choose a pet
          </button>
          <button
            type="button"
            onClick={() => setModalOpen("items")}
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Choose an item
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="price" className="text-sm font-medium">
          Price (coins)
        </label>
        <input
          id="price"
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
          className="w-32 rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Listing…" : "List for sale"}
      </button>

      {modalOpen === "pets" ? (
        <PetPickerModal
          title="Choose a pet to sell"
          pets={pickerPets}
          selectedIds={selectedPetId ? new Set([selectedPetId]) : new Set()}
          onToggle={choosePet}
          onClose={() => setModalOpen(null)}
          emptyText="You don't have any pets."
        />
      ) : null}
      {modalOpen === "items" ? (
        <ItemPickerModal
          title="Choose an item to sell"
          items={pickerItems}
          quantities={selectedItemId ? { [selectedItemId]: selectedItemQty } : {}}
          onSetQuantity={chooseItemQuantity}
          onClose={() => setModalOpen(null)}
          emptyText="You don't have any items."
        />
      ) : null}
    </div>
  );
}
