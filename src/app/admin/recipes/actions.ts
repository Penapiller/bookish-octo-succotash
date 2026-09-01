"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { PotionEffectType } from "@/lib/supabase/types";

const EFFECT_TYPES: PotionEffectType[] = [
  "duration_reduction",
  "rarity_boost",
  "item_find_boost",
  "double_reward_chance",
];

// The brewing stand only has 3 ingredient slots and requires an exact
// item/quantity match — a recipe whose ingredient quantities sum past 3
// could never actually be brewed. See SLOT_COUNT in brewing-stand.tsx.
const MAX_TOTAL_INGREDIENT_QUANTITY = 3;

export type RecipeFormState = { error: string } | null;

function readRecipeFields(formData: FormData) {
  const effectType = String(formData.get("effect_type") ?? "");
  const effectMagnitudeRaw = String(formData.get("effect_magnitude") ?? "");
  const isActive = formData.get("is_active") === "on";

  if (!EFFECT_TYPES.includes(effectType as PotionEffectType)) {
    return { ok: false as const, error: "Invalid effect type." };
  }

  const effectMagnitude = Number(effectMagnitudeRaw);
  if (!Number.isFinite(effectMagnitude) || effectMagnitude <= 0) {
    return { ok: false as const, error: "Effect magnitude must be a positive number." };
  }

  return {
    ok: true as const,
    fields: {
      effect_type: effectType as PotionEffectType,
      effect_magnitude: effectMagnitude,
      is_active: isActive,
    },
  };
}

export async function createRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const { supabase } = await requireAdmin();

  const existingPotionItemId = String(formData.get("existing_potion_item_id") ?? "");
  const newPotionName = String(formData.get("new_potion_name") ?? "").trim();
  const newPotionImageUrl = String(formData.get("new_potion_image_url") ?? "").trim();

  let outputPotionItemId = existingPotionItemId;

  if (outputPotionItemId.length === 0) {
    if (newPotionName.length === 0) {
      return { error: "Pick an existing potion or name a new one." };
    }
    const { data: newItem, error: newItemError } = await supabase
      .from("items")
      .insert({
        name: newPotionName,
        type: "potion",
        rarity: "common",
        image_url: newPotionImageUrl.length > 0 ? newPotionImageUrl : null,
        sell_value: 0,
        is_active: true,
      })
      .select("id")
      .single();

    if (newItemError || !newItem) {
      return { error: `Could not create potion item: ${newItemError?.message ?? "unknown error"}` };
    }
    outputPotionItemId = newItem.id;
  }

  const parsed = readRecipeFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await supabase
    .from("potion_recipes")
    .insert({ output_potion_item_id: outputPotionItemId, ...parsed.fields })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Could not create recipe: ${error?.message ?? "unknown error"}` };
  }

  revalidatePath("/admin/recipes");
  redirect(`/admin/recipes/${data.id}`);
}

export async function updateRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const { supabase } = await requireAdmin();

  const recipeId = String(formData.get("recipe_id") ?? "");
  if (recipeId.length === 0) return { error: "Missing recipe id." };

  const parsed = readRecipeFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("potion_recipes").update(parsed.fields).eq("id", recipeId);
  if (error) {
    return { error: `Could not save recipe: ${error.message}` };
  }

  revalidatePath("/admin/recipes");
  revalidatePath(`/admin/recipes/${recipeId}`);
  return null;
}

export async function addIngredient(formData: FormData) {
  const { supabase } = await requireAdmin();

  const recipeId = String(formData.get("recipe_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const quantityRequired = Number(formData.get("quantity_required") ?? "1");

  if (recipeId.length === 0 || itemId.length === 0) return;
  if (!Number.isInteger(quantityRequired) || quantityRequired < 1) return;

  const { data: existing } = await supabase
    .from("potion_recipe_ingredients")
    .select("item_id, quantity_required")
    .eq("recipe_id", recipeId);

  const currentTotal = (existing ?? [])
    .filter((row) => row.item_id !== itemId)
    .reduce((sum, row) => sum + row.quantity_required, 0);

  if (currentTotal + quantityRequired > MAX_TOTAL_INGREDIENT_QUANTITY) {
    // The brewing stand only has 3 slots total — silently clamp rather
    // than erroring, since this is a same-page progressive-enhancement
    // form with no error display wired up.
    return;
  }

  await supabase
    .from("potion_recipe_ingredients")
    .upsert(
      { recipe_id: recipeId, item_id: itemId, quantity_required: quantityRequired },
      { onConflict: "recipe_id,item_id" },
    );

  revalidatePath(`/admin/recipes/${recipeId}`);
}

export async function removeIngredient(formData: FormData) {
  const { supabase } = await requireAdmin();

  const recipeId = String(formData.get("recipe_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  if (recipeId.length === 0 || itemId.length === 0) return;

  await supabase
    .from("potion_recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("item_id", itemId);

  revalidatePath(`/admin/recipes/${recipeId}`);
}
