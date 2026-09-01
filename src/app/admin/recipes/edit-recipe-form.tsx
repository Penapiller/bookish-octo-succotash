"use client";

import { useActionState } from "react";
import { updateRecipe, type RecipeFormState } from "./actions";
import type { PotionEffectType, PotionRecipeRow } from "@/lib/supabase/types";

const EFFECT_TYPES: { value: PotionEffectType; label: string }[] = [
  { value: "duration_reduction", label: "Duration reduction (shorter expeditions)" },
  { value: "rarity_boost", label: "Rarity boost" },
  { value: "item_find_boost", label: "Higher chance to find items" },
  { value: "double_reward_chance", label: "Chance of a double reward" },
];

const initialState: RecipeFormState = null;

export function EditRecipeForm({ recipe }: { recipe: PotionRecipeRow }) {
  const [state, formAction, isPending] = useActionState(updateRecipe, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      <input type="hidden" name="recipe_id" value={recipe.id} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="effect_type" className="text-sm font-medium">
          Effect
        </label>
        <select
          id="effect_type"
          name="effect_type"
          defaultValue={recipe.effect_type}
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
          defaultValue={recipe.effect_magnitude}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={recipe.is_active}
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
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
