"use client";

import { useActionState, useState } from "react";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
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
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
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
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          {ITEM_RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Image</span>
        <div className="flex items-center gap-3">
          {previewUrl || item?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, which next/image can't optimize
            <img
              src={previewUrl ?? item!.image_url!}
              alt=""
              className="h-16 w-16 rounded border border-amber-300 object-cover dark:border-stone-700"
            />
          ) : (
            <div className="h-16 w-16 rounded border border-dashed border-amber-300 dark:border-stone-700" />
          )}
          <div className="flex flex-col gap-1">
            <input
              id="image_file"
              name="image_file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm"
            />
            <p className="text-xs text-stone-500">PNG, JPEG, WebP, or GIF — up to 5 MB.</p>
          </div>
        </div>
        <label htmlFor="image_url" className="mt-1 text-xs text-stone-500">
          Or paste an image URL instead (used only if no file is uploaded above)
        </label>
        <input
          id="image_url"
          name="image_url"
          defaultValue={item?.image_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
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
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={item?.is_active ?? true}
          className="h-4 w-4 rounded border-amber-300 dark:border-stone-700"
        />
        Active (visible in loot tables / recipes)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
