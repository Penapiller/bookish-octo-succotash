"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import type { ActiveBrewSummary, OwnedIngredient, RecipeWithDetails } from "@/lib/supabase/types";

const STAND_IMAGE_URL =
  "https://placehold.co/800x500/3b0764/FFFFFF/png?text=Brewing+Stand+%28Placeholder%29";
const SLOT_COUNT = 3;

function describeEffect(recipe: RecipeWithDetails): string {
  switch (recipe.effect_type) {
    case "duration_reduction":
      return `~${Math.round(recipe.effect_magnitude * 100)}% shorter expeditions`;
    case "item_find_boost":
      return "Higher chance an expedition finds an item instead of a pet";
    case "double_reward_chance":
      return `${Math.round(recipe.effect_magnitude * 100)}% chance of a bonus second reward`;
    case "rarity_boost":
    default:
      return "Improves rare outcome odds";
  }
}

export function BrewingStand({
  recipes,
  ownedIngredients,
  activeBrew,
}: {
  recipes: RecipeWithDetails[];
  ownedIngredients: OwnedIngredient[];
  activeBrew: ActiveBrewSummary | null;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<(string | null)[]>(Array(SLOT_COUNT).fill(null));
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [isBrewing, setIsBrewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingredientsById = useMemo(
    () => new Map(ownedIngredients.map((i) => [i.itemId, i])),
    [ownedIngredients],
  );

  // How many of each item are currently sitting in a slot — this is
  // purely client-side staging. Nothing is deducted from the inventory
  // until start_brew runs, which re-verifies ownership server-side
  // regardless of what's shown here.
  const placedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const itemId of slots) {
      if (itemId) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    return counts;
  }, [slots]);

  // Exact-match: the filled slots' item/quantity multiset must equal a
  // recipe's ingredient list exactly — same item ids, same counts, no
  // extras either direction. Empty slots just don't count toward this.
  const matchedRecipe = useMemo(() => {
    if (placedCounts.size === 0) return null;
    for (const recipe of recipes) {
      const required = new Map(
        recipe.ingredients
          .filter((ing) => ing.item)
          .map((ing) => [ing.item!.id, ing.quantityRequired]),
      );
      if (required.size !== placedCounts.size) continue;
      let matches = true;
      for (const [itemId, quantity] of required) {
        if (placedCounts.get(itemId) !== quantity) {
          matches = false;
          break;
        }
      }
      if (matches) return recipe;
    }
    return null;
  }, [placedCounts, recipes]);

  function availableQuantity(itemId: string) {
    const owned = ingredientsById.get(itemId)?.quantity ?? 0;
    const placed = placedCounts.get(itemId) ?? 0;
    return owned - placed;
  }

  function placeItem(slotIndex: number, itemId: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = itemId;
      return next;
    });
    setPickerSlotIndex(null);
    setError(null);
  }

  function clearSlot(slotIndex: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    setError(null);
  }

  // Convenience shortcut from the recipe book — only offered for recipes
  // the player can already afford (see RecipeBookModal), so this never
  // places more of an item than they actually own.
  function fillSlotsFromRecipe(recipe: RecipeWithDetails) {
    const next: (string | null)[] = Array(SLOT_COUNT).fill(null);
    let slotIndex = 0;
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.item) continue;
      for (let n = 0; n < ingredient.quantityRequired && slotIndex < SLOT_COUNT; n++) {
        next[slotIndex] = ingredient.item.id;
        slotIndex++;
      }
    }
    setSlots(next);
    setIsBookOpen(false);
    setError(null);
  }

  async function handleStartBrewing() {
    if (!matchedRecipe) return;
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

    const { error: rpcError } = await supabase.rpc("start_brew", {
      p_user_id: user.id,
      p_recipe_id: matchedRecipe.id,
    });

    setIsBrewing(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSlots(Array(SLOT_COUNT).fill(null));
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-amber-200 dark:border-stone-800">
        <div className="relative aspect-[8/5] w-full">
          <Image
            src={STAND_IMAGE_URL}
            alt="Brewing stand"
            fill
            sizes="512px"
            className="object-cover"
            priority
          />
        </div>
        <button
          type="button"
          onClick={() => setIsBookOpen(true)}
          aria-label="Open recipe book"
          title="Recipe book"
          className="absolute right-3 top-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white dark:bg-stone-900/90 dark:hover:bg-stone-900"
        >
          <Image src="/icons/book.png" alt="" width={38} height={33} />
        </button>
      </div>

      {activeBrew ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-purple-600 p-4 text-center">
          {activeBrew.potionImageUrl ? (
            <Image
              src={activeBrew.potionImageUrl}
              alt={activeBrew.potionName}
              width={64}
              height={64}
              className="h-16 w-16 rounded border-2 border-purple-600"
            />
          ) : null}
          {activeBrew.status === "awaiting_claim" ? (
            <>
              <p className="font-medium">{activeBrew.potionName} is ready!</p>
              <button
                type="button"
                onClick={() => setIsClaimOpen(true)}
                className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
              >
                Claim potion
              </button>
            </>
          ) : (
            <>
              <p className="font-medium">Brewing {activeBrew.potionName}…</p>
              <ExpeditionCountdown resolvesAt={activeBrew.resolves_at} />
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            {slots.map((itemId, index) => {
              const ingredient = itemId ? ingredientsById.get(itemId) : null;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => (itemId ? clearSlot(index) : setPickerSlotIndex(index))}
                  title={itemId ? "Click to remove" : "Click to add an ingredient"}
                  className="flex h-20 w-20 items-center justify-center bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url(${itemId ? "/ui/item-slot-selected.png" : "/ui/item-slot.png"})`,
                  }}
                >
                  {ingredient?.image_url ? (
                    <Image
                      src={ingredient.image_url}
                      alt={ingredient.name}
                      width={60}
                      height={60}
                      className="h-[60px] w-[60px] rounded"
                    />
                  ) : (
                    <span className="text-xs text-stone-400">Empty</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            {matchedRecipe ? (
              <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                Recipe found: {matchedRecipe.potion?.name}
              </p>
            ) : (
              <p className="text-sm text-stone-500">
                {placedCounts.size === 0
                  ? "Add ingredients to a slot to begin."
                  : "No matching recipe."}
              </p>
            )}
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <button
              type="button"
              onClick={handleStartBrewing}
              disabled={!matchedRecipe || isBrewing}
              className="rounded-md bg-purple-700 px-6 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-60"
            >
              {isBrewing ? "Starting…" : "Start brewing"}
            </button>
          </div>
        </>
      )}

      {pickerSlotIndex !== null ? (
        <IngredientPickerModal
          ownedIngredients={ownedIngredients}
          availableQuantity={availableQuantity}
          onSelect={(itemId) => placeItem(pickerSlotIndex, itemId)}
          onClose={() => setPickerSlotIndex(null)}
        />
      ) : null}

      {isBookOpen ? (
        <RecipeBookModal
          recipes={recipes}
          onFillSlots={fillSlotsFromRecipe}
          onClose={() => setIsBookOpen(false)}
        />
      ) : null}

      {isClaimOpen && activeBrew ? (
        <ClaimBrewModal
          brewId={activeBrew.id}
          potionName={activeBrew.potionName}
          potionImageUrl={activeBrew.potionImageUrl}
          onClose={() => setIsClaimOpen(false)}
        />
      ) : null}
    </div>
  );
}

function IngredientPickerModal({
  ownedIngredients,
  availableQuantity,
  onSelect,
  onClose,
}: {
  ownedIngredients: OwnedIngredient[];
  availableQuantity: (itemId: string) => number;
  onSelect: (itemId: string) => void;
  onClose: () => void;
}) {
  const selectable = ownedIngredients.filter((i) => availableQuantity(i.itemId) > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose an ingredient"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 dark:bg-stone-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Choose an ingredient</h2>
          <button type="button" onClick={onClose} className="text-sm text-stone-500 hover:underline">
            Close
          </button>
        </div>
        {selectable.length === 0 ? (
          <p className="text-sm text-stone-500 italic">
            You don&apos;t have any spare ingredients. Send pets on expeditions to find some.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {selectable.map((ingredient) => (
              <li key={ingredient.itemId}>
                <button
                  type="button"
                  onClick={() => onSelect(ingredient.itemId)}
                  className="flex w-full flex-col items-center gap-1 rounded-lg border border-amber-200 p-2 text-center hover:bg-amber-100 dark:border-stone-800 dark:hover:bg-stone-800"
                >
                  {ingredient.image_url ? (
                    <Image
                      src={ingredient.image_url}
                      alt={ingredient.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded border-2 border-green-600"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded bg-amber-200 dark:bg-stone-800" />
                  )}
                  <span className="text-xs">{ingredient.name}</span>
                  <span className="text-xs text-stone-500">
                    ×{availableQuantity(ingredient.itemId)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// 3 recipes per page-side (6 per two-page spread) — a fixed, small
// amount of content per spread so nothing ever needs to scroll past
// the book art's safe zone (see the page-box insets below, calibrated
// against the actual illustration so cells never overlap the spine or
// the curved page edges).
const RECIPES_PER_SIDE = 3;
const RECIPES_PER_SPREAD = RECIPES_PER_SIDE * 2;
const LEFT_PAGE_BOX = { left: "10%", top: "12%", width: "35%", height: "74%" };
const RIGHT_PAGE_BOX = { left: "55%", top: "12%", width: "35%", height: "74%" };

function RecipeCell({
  recipe,
  onFillSlots,
}: {
  recipe: RecipeWithDetails;
  onFillSlots: (recipe: RecipeWithDetails) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onFillSlots(recipe)}
      disabled={!recipe.canBrew}
      title={
        recipe.canBrew
          ? "Fill the slots with this recipe's ingredients"
          : "You don't have enough ingredients"
      }
      className="flex flex-1 items-center justify-center gap-2 rounded-lg hover:bg-white/40 disabled:opacity-50"
    >
      <div className="flex items-center gap-1.5">
        {recipe.ingredients.map((ing) =>
          ing.item ? (
            <div key={ing.item.id} className="relative shrink-0">
              {ing.item.image_url ? (
                <Image
                  src={ing.item.image_url}
                  alt={ing.item.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded border-2 border-green-600"
                />
              ) : (
                <div className="h-11 w-11 rounded bg-amber-200" />
              )}
              {ing.quantityRequired > 1 ? (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-stone-900 px-1.5 text-xs font-medium leading-tight text-white">
                  ×{ing.quantityRequired}
                </span>
              ) : null}
            </div>
          ) : null,
        )}
      </div>

      <span className="shrink-0 text-2xl text-stone-500" aria-hidden="true">
        →
      </span>

      <div className="group relative shrink-0">
        {recipe.potion?.image_url ? (
          <Image
            src={recipe.potion.image_url}
            alt={recipe.potion.name}
            width={56}
            height={56}
            className="h-14 w-14 rounded border-2 border-purple-600"
          />
        ) : (
          <div className="h-14 w-14 rounded bg-amber-200" />
        )}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 rounded-md bg-stone-900 px-2 py-1.5 text-center text-sm text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          <p className="font-medium">{recipe.potion?.name}</p>
          <p>{describeEffect(recipe)}</p>
        </div>
      </div>
    </button>
  );
}

function RecipeBookModal({
  recipes,
  onFillSlots,
  onClose,
}: {
  recipes: RecipeWithDetails[];
  onFillSlots: (recipe: RecipeWithDetails) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(recipes.length / RECIPES_PER_SPREAD));
  const spreadRecipes = recipes.slice(page * RECIPES_PER_SPREAD, page * RECIPES_PER_SPREAD + RECIPES_PER_SPREAD);
  const leftRecipes = spreadRecipes.slice(0, RECIPES_PER_SIDE);
  const rightRecipes = spreadRecipes.slice(RECIPES_PER_SIDE);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Recipe book"
    >
      <div className="flex w-full max-w-4xl flex-col gap-3">
        <div className="flex items-center justify-between text-white">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Image src="/icons/book.png" alt="" width={30} height={26} />
            Recipe book
          </h2>
          <button type="button" onClick={onClose} className="text-sm hover:underline">
            Close
          </button>
        </div>
        <p className="text-sm text-white/80">
          Every recipe is visible here for testing. Hover a potion to see what it does.
        </p>

        <div className="relative w-full">
          <Image
            src="/ui/book-container.png"
            alt=""
            width={1720}
            height={1021}
            className="h-auto w-full"
            priority
          />
          {recipes.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm italic text-stone-600">
              No recipes yet.
            </p>
          ) : (
            <>
              <div className="absolute flex flex-col" style={LEFT_PAGE_BOX}>
                {leftRecipes.map((recipe) => (
                  <RecipeCell key={recipe.id} recipe={recipe} onFillSlots={onFillSlots} />
                ))}
              </div>
              <div className="absolute flex flex-col" style={RIGHT_PAGE_BOX}>
                {rightRecipes.map((recipe) => (
                  <RecipeCell key={recipe.id} recipe={recipe} onFillSlots={onFillSlots} />
                ))}
              </div>
            </>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-4 text-sm text-white">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md bg-white/20 px-3 py-1.5 hover:bg-white/30 disabled:opacity-40"
            >
              ← Previous page
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="rounded-md bg-white/20 px-3 py-1.5 hover:bg-white/30 disabled:opacity-40"
            >
              Next page →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClaimBrewModal({
  brewId,
  potionName,
  potionImageUrl,
  onClose,
}: {
  brewId: string;
  potionName: string;
  potionImageUrl: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCollect() {
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired — please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("claim_brew", {
      p_user_id: user.id,
      p_brew_id: brewId,
    });

    setIsSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Finished potion"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-white p-6 text-center dark:bg-stone-900">
        <h2 className="text-lg font-semibold tracking-tight">Your potion is ready!</h2>
        {potionImageUrl ? (
          <Image
            src={potionImageUrl}
            alt={potionName}
            width={112}
            height={112}
            className="h-28 w-28 rounded border-2 border-purple-600"
          />
        ) : (
          <div className="h-28 w-28 rounded bg-amber-200 dark:bg-stone-800" />
        )}
        <p className="font-medium">{potionName}</p>

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <button
          type="button"
          onClick={handleCollect}
          disabled={isSubmitting}
          className="w-full rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-60"
        >
          {isSubmitting ? "…" : "Collect"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-sm text-stone-500 hover:underline disabled:opacity-60"
        >
          Close for now
        </button>
      </div>
    </div>
  );
}
