"use client";

import { useActionState } from "react";
import { createRecipe, type RecipeFormState } from "./actions";
import type { PotionEffectType } from "@/lib/supabase/types";

const EFFECT_TYPES: { value: PotionEffectType; label: string }[] = [
  { value: "duration_reduction", label: "Duration reduction (shorter expeditions)" },
  { value: "rarity_boost", label: "Rarity boost" },
  { value: "item_find_boost", label: "Higher chance to find items" },
  { value: "double_reward_chance", label: "Chance of a double reward" },
];

const initialState: RecipeFormState = null;

export function NewRecipeForm({
  existingPotions,
}: {
  existingPotions: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createRecipe, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      <fieldset className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium">Output potion</legend>
        {existingPotions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="existing_potion_item_id" className="text-xs text-zinc-500">
              Use an existing potion item
            </label>
            <select
              id="existing_potion_item_id"
              name="existing_potion_item_id"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— none —</option>
              {existingPotions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">Or create a new potion item:</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new_potion_name" className="text-xs text-zinc-500">
            New potion name
          </label>
          <input
            id="new_potion_name"
            name="new_potion_name"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new_potion_image_url" className="text-xs text-zinc-500">
            New potion image URL
          </label>
          <input
            id="new_potion_image_url"
            name="new_potion_image_url"
            placeholder="https://…"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="effect_type" className="text-sm font-medium">
          Effect
        </label>
        <select
          id="effect_type"
          name="effect_type"
          defaultValue="duration_reduction"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {EFFECT_TYPES.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="effect_magnitude" className="text-sm font-medium">
          Effect magnitude
        </label>
        <input
          id="effect_magnitude"
          name="effect_magnitude"
          type="number"
          min={0}
          step={0.01}
          defaultValue={1}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="text-xs text-zinc-500">
          Meaning depends on the effect — e.g. a multiplier for boosts, a fraction for duration
          reduction.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        Active (visible in the recipe book)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Creating…" : "Create recipe"}
      </button>
    </form>
  );
}
