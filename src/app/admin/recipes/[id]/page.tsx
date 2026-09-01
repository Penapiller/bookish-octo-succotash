import Image from "next/image";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { EditRecipeForm } from "../edit-recipe-form";
import { addIngredient, removeIngredient } from "../actions";
import type { PotionEffectType } from "@/lib/supabase/types";

type IngredientRow = {
  item_id: string;
  quantity_required: number;
  items: { name: string; image_url: string | null } | null;
};

// Hand-cast, like the other joined selects in this project — see the
// comment on PetWithSpecies in lib/supabase/types.ts.
type RecipeDetailRow = {
  id: string;
  output_potion_item_id: string;
  effect_type: PotionEffectType;
  effect_magnitude: number;
  is_active: boolean;
  created_at: string;
  potion: { name: string; image_url: string | null } | null;
};

export default async function EditRecipePage(props: PageProps<"/admin/recipes/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: recipeData }, { data: ingredientsData }, { data: allItems }] = await Promise.all([
    supabase
      .from("potion_recipes")
      .select(
        "id, output_potion_item_id, effect_type, effect_magnitude, is_active, created_at, potion:items!potion_recipes_output_potion_item_id_fkey(name, image_url)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("potion_recipe_ingredients")
      .select("item_id, quantity_required, items(name, image_url)")
      .eq("recipe_id", id),
    supabase.from("items").select("id, name").eq("is_active", true).order("name"),
  ]);

  const recipe = recipeData as unknown as RecipeDetailRow | null;

  if (!recipe) {
    notFound();
  }

  const ingredients = (ingredientsData ?? []) as unknown as IngredientRow[];
  const usedItemIds = new Set(ingredients.map((i) => i.item_id));
  const ingredientTotal = ingredients.reduce((sum, i) => sum + i.quantity_required, 0);
  const availableItems = (allItems ?? []).filter((i) => !usedItemIds.has(i.id));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {recipe.potion?.image_url ? (
            <Image
              src={recipe.potion.image_url}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded"
            />
          ) : null}
          Edit recipe: {recipe.potion?.name ?? "(deleted item)"}
        </h2>
        <EditRecipeForm recipe={recipe} />
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold tracking-tight">Ingredients</h3>
        <p className="text-sm text-zinc-500">
          The brewing stand has 3 slots, and a brew must match a recipe&apos;s ingredients
          exactly — {ingredientTotal} / 3 slots used.
        </p>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Quantity required</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {ingredients.map((entry) => (
                <tr key={entry.item_id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      {entry.items?.image_url ? (
                        <Image
                          src={entry.items.image_url}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded"
                        />
                      ) : null}
                      {entry.items?.name ?? "(deleted item)"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{entry.quantity_required}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={removeIngredient}>
                      <input type="hidden" name="recipe_id" value={recipe.id} />
                      <input type="hidden" name="item_id" value={entry.item_id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {ingredients.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-zinc-500">
                    No ingredients yet — this recipe can&apos;t be brewed until you add some.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {availableItems.length > 0 && ingredientTotal < 3 ? (
          <form action={addIngredient} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="item_id" className="text-xs text-zinc-500">
                Item
              </label>
              <select
                id="item_id"
                name="item_id"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {availableItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quantity_required" className="text-xs text-zinc-500">
                Quantity
              </label>
              <input
                id="quantity_required"
                name="quantity_required"
                type="number"
                min={1}
                max={3 - ingredientTotal}
                step={1}
                defaultValue={1}
                required
                className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Add ingredient
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
