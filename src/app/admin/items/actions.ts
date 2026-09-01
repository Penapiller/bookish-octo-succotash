"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { ItemRarity, ItemType } from "@/lib/supabase/types";

const ITEM_TYPES: ItemType[] = ["ingredient", "cosmetic", "potion"];
const ITEM_RARITIES: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export type ItemFormState = { error: string } | null;

function readItemFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const rarity = String(formData.get("rarity") ?? "");
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const sellValueRaw = String(formData.get("sell_value") ?? "");
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (!ITEM_TYPES.includes(type as ItemType))
    return { ok: false as const, error: "Invalid item type." };
  if (!ITEM_RARITIES.includes(rarity as ItemRarity))
    return { ok: false as const, error: "Invalid rarity." };

  const sellValue = Number(sellValueRaw);
  if (!Number.isInteger(sellValue) || sellValue < 0) {
    return { ok: false as const, error: "Sell value must be a non-negative whole number." };
  }

  return {
    ok: true as const,
    fields: {
      name,
      type: type as ItemType,
      rarity: rarity as ItemRarity,
      image_url: imageUrlRaw.length > 0 ? imageUrlRaw : null,
      sell_value: sellValue,
      is_active: isActive,
    },
  };
}

export async function createItem(
  _prevState: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readItemFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("items").insert(parsed.fields);
  if (error) {
    return { error: `Could not create item: ${error.message}` };
  }

  revalidatePath("/admin/items");
  redirect("/admin/items");
}

export async function updateItem(
  _prevState: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const { supabase } = await requireAdmin();

  const itemId = String(formData.get("item_id") ?? "");
  if (itemId.length === 0) return { error: "Missing item id." };

  const parsed = readItemFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("items").update(parsed.fields).eq("id", itemId);
  if (error) {
    return { error: `Could not save item: ${error.message}` };
  }

  revalidatePath("/admin/items");
  redirect("/admin/items");
}
