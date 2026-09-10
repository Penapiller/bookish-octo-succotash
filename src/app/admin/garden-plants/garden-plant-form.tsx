"use client";

import { useActionState } from "react";
import type { GardenPlantFormState } from "./actions";
import type { GardenPlantRow } from "@/lib/supabase/types";

const initialState: GardenPlantFormState = null;

// URL-only for the 3 stage images (no file upload, unlike species/items) —
// this is the game's own crop catalog, small in number and, like zones/
// recipes, fine starting with placeholder art wired in by hand. A plain
// <select> for the produce item (not SearchablePicker) — that component
// always starts unselected, which works for "add a new pool/loot entry"
// but not for a single field that already has a value on the edit form.
export function GardenPlantForm({
  action,
  plant,
  produceItemOptions,
  submitLabel,
}: {
  action: (prevState: GardenPlantFormState, formData: FormData) => Promise<GardenPlantFormState>;
  plant?: GardenPlantRow;
  produceItemOptions: { id: string; label: string }[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {plant ? <input type="hidden" name="plant_id" value={plant.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={plant?.name ?? ""}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image_stage1_url" className="text-sm font-medium">
          Stage 1 image URL (sprout)
        </label>
        <input
          id="image_stage1_url"
          name="image_stage1_url"
          defaultValue={plant?.image_stage1_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image_stage2_url" className="text-sm font-medium">
          Stage 2 image URL (growing)
        </label>
        <input
          id="image_stage2_url"
          name="image_stage2_url"
          defaultValue={plant?.image_stage2_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image_stage3_url" className="text-sm font-medium">
          Stage 3 image URL (mature)
        </label>
        <input
          id="image_stage3_url"
          name="image_stage3_url"
          defaultValue={plant?.image_stage3_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="produce_item_id" className="text-sm font-medium">
          Produce item (harvested into inventory)
        </label>
        <select
          id="produce_item_id"
          name="produce_item_id"
          defaultValue={plant?.produce_item_id ?? ""}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <option value="">— None (coins-only crop) —</option>
          {produceItemOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="produce_quantity_min" className="text-sm font-medium">
            Min quantity
          </label>
          <input
            id="produce_quantity_min"
            name="produce_quantity_min"
            type="number"
            min={1}
            step={1}
            defaultValue={plant?.produce_quantity_min ?? 1}
            required
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="produce_quantity_max" className="text-sm font-medium">
            Max quantity
          </label>
          <input
            id="produce_quantity_max"
            name="produce_quantity_max"
            type="number"
            min={1}
            step={1}
            defaultValue={plant?.produce_quantity_max ?? 1}
            required
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="base_coin_yield" className="text-sm font-medium">
          Base coin yield
        </label>
        <input
          id="base_coin_yield"
          name="base_coin_yield"
          type="number"
          min={0}
          step={1}
          defaultValue={plant?.base_coin_yield ?? 0}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={plant?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active (plantable via a seed pool)
      </label>

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
