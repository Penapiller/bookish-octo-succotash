import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrewingBoard } from "@/components/brewing-board";
import type {
  ItemRarity,
  RecipeIngredientWithStock,
  RecipeWithDetails,
} from "@/lib/supabase/types";

// Row shapes of the joined selects below. Hand-cast, like the other
// joined selects in this project — see the comment on PetWithSpecies in
// lib/supabase/types.ts.
type RecipeRow = {
  id: string;
  effect_type: RecipeWithDetails["effect_type"];
  effect_magnitude: number;
  is_active: boolean;
  potion: { id: string; name: string; image_url: string | null; rarity: ItemRarity } | null;
};
type IngredientRow = {
  recipe_id: string;
  quantity_required: number;
  item: { id: string; name: string; image_url: string | null; rarity: ItemRarity } | null;
};

export default async function BrewingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: recipesData }, { data: ingredientsData }, { data: inventoryData }] =
    await Promise.all([
      supabase
        .from("potion_recipes")
        .select("id, effect_type, effect_magnitude, is_active, potion:items(id, name, image_url, rarity)")
        .eq("is_active", true),
      supabase
        .from("potion_recipe_ingredients")
        .select("recipe_id, quantity_required, item:items(id, name, image_url, rarity)"),
      supabase.from("user_inventory").select("item_id, quantity").eq("user_id", user.id),
    ]);

  const ownedQuantityByItem = new Map<string, number>();
  for (const row of inventoryData ?? []) {
    ownedQuantityByItem.set(row.item_id, row.quantity);
  }

  const ingredientsByRecipe = new Map<string, RecipeIngredientWithStock[]>();
  for (const row of (ingredientsData ?? []) as unknown as IngredientRow[]) {
    const list = ingredientsByRecipe.get(row.recipe_id) ?? [];
    list.push({
      item: row.item,
      quantityRequired: row.quantity_required,
      quantityOwned: row.item ? (ownedQuantityByItem.get(row.item.id) ?? 0) : 0,
    });
    ingredientsByRecipe.set(row.recipe_id, list);
  }

  const recipes: RecipeWithDetails[] = ((recipesData ?? []) as unknown as RecipeRow[]).map(
    (recipe) => {
      const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
      return {
        id: recipe.id,
        effect_type: recipe.effect_type,
        effect_magnitude: recipe.effect_magnitude,
        is_active: recipe.is_active,
        potion: recipe.potion,
        ingredients,
        canBrew:
          ingredients.length > 0 &&
          ingredients.every((ing) => ing.quantityOwned >= ing.quantityRequired),
      };
    },
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brewing</h1>
        <p className="text-sm text-zinc-500">
          These are the same recipes for every player — no discovery or unlocking, just whether
          you have the ingredients. Click a potion to see what it takes.
        </p>
      </div>
      <BrewingBoard recipes={recipes} />
    </main>
  );
}
