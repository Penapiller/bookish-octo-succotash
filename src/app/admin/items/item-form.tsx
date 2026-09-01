"use client";

import { useActionState } from "react";
import type { ItemFormState } from "./actions";
import type { ItemRarity, ItemRow, ItemType } from "@/lib/supabase/types";

const ITEM_TYPES: ItemType[] = ["ingredient", "cosmetic", "potion"];
const ITEM_RARITIES: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const initialState: ItemFormState = null;

export function ItemForm({
  action,
  item,
  submitLabel,
}: {
  action: (prevState: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: ItemRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {item ? <input type="hidden" name="item_id" value={item.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={item?.name ?? ""}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="type" className="text-sm font-medium">
          Type
        </label>
        <select
          id="type"
          name="type"
          defaultValue={item?.type ?? "ingredient"}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rarity" className="text-sm font-medium">
          Rarity
        </label>
        <select
          id="rarity"
          name="rarity"
          defaultValue={item?.rarity ?? "common"}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ITEM_RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image_url" className="text-sm font-medium">
          Image URL
        </label>
        <input
          id="image_url"
          name="image_url"
          defaultValue={item?.image_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sell_value" className="text-sm font-medium">
          Sell value
        </label>
        <input
          id="sell_value"
          name="sell_value"
          type="number"
          min={0}
          step={1}
          defaultValue={item?.sell_value ?? 0}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={item?.is_active ?? true}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        Active (visible in loot tables / recipes)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
