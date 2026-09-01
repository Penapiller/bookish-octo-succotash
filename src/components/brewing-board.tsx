"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecipeWithDetails } from "@/lib/supabase/types";

export function BrewingBoard({ recipes }: { recipes: RecipeWithDetails[] }) {
  const router = useRouter();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isBrewing, setIsBrewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;

  function openRecipe(id: string) {
    setSelectedRecipeId(id);
    setError(null);
  }

  async function handleBrew() {
    if (!selectedRecipeId) return;
    setIsBrewing(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired — please sign in again.");
      setIsBrewing(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("brew_potion", {
      p_user_id: user.id,
      p_recipe_id: selectedRecipeId,
    });

    setIsBrewing(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSelectedRecipeId(null);
    router.refresh();
  }

  if (recipes.length === 0) {
    return <p className="text-sm text-zinc-500 italic">No recipes yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <button
              type="button"
              onClick={() => openRecipe(recipe.id)}
              className={`flex w-full flex-col items-center gap-2 rounded-lg border p-3 text-center hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                recipe.canBrew
                  ? "border-purple-600"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {recipe.potion?.image_url ? (
                <Image
                  src={recipe.potion.image_url}
                  alt={recipe.potion.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded border-2 border-purple-600"
                />
              ) : (
                <div className="h-20 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
              )}
              <span className="text-sm font-medium">{recipe.potion?.name}</span>
              <span
                className={`text-xs ${recipe.canBrew ? "text-green-600 dark:text-green-400" : "text-zinc-500"}`}
              >
                {recipe.canBrew ? "Ready to brew" : "Missing ingredients"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selectedRecipe ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Recipe details"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 dark:bg-zinc-900">
            <div className="flex items-center gap-4">
              {selectedRecipe.potion?.image_url ? (
                <Image
                  src={selectedRecipe.potion.image_url}
                  alt={selectedRecipe.potion.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded border-2 border-purple-600"
                />
              ) : null}
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {selectedRecipe.potion?.name}
                </h2>
                <p className="text-xs capitalize text-zinc-500">
                  {selectedRecipe.potion?.rarity} potion
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-500">
              {selectedRecipe.effect_type === "duration_reduction"
                ? `Shortens an expedition's timer by roughly ${Math.round(selectedRecipe.effect_magnitude * 100)}%.`
                : "Improves rare outcome odds on an expedition."}{" "}
              Never guarantees a result — just shifts the odds.
            </p>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Ingredients</h3>
              <ul className="flex flex-col gap-1.5">
                {selectedRecipe.ingredients.map((ing) => (
                  <li key={ing.item?.id} className="flex items-center gap-3 text-sm">
                    {ing.item?.image_url ? (
                      <Image
                        src={ing.item.image_url}
                        alt={ing.item.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded border-2 border-green-600"
                      />
                    ) : null}
                    <span className="flex-1">{ing.item?.name}</span>
                    <span
                      className={
                        ing.quantityOwned >= ing.quantityRequired
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {ing.quantityOwned} / {ing.quantityRequired}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBrew}
                disabled={isBrewing || !selectedRecipe.canBrew}
                className="flex-1 rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-60"
              >
                {isBrewing ? "Brewing…" : "Brew"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecipeId(null)}
                disabled={isBrewing}
                className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
