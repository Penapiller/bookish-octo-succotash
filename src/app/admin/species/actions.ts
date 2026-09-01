"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { PetRarity } from "@/lib/supabase/types";

const RARITIES: PetRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export type SpeciesFormState = { error: string } | null;

function readSpeciesFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rarity = String(formData.get("rarity") ?? "");
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (!RARITIES.includes(rarity as PetRarity))
    return { ok: false as const, error: "Invalid rarity." };

  return {
    ok: true as const,
    fields: {
      name,
      rarity: rarity as PetRarity,
      image_url: imageUrlRaw.length > 0 ? imageUrlRaw : null,
      is_active: isActive,
    },
  };
}

export async function createSpecies(
  _prevState: SpeciesFormState,
  formData: FormData,
): Promise<SpeciesFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readSpeciesFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("species").insert(parsed.fields);
  if (error) {
    return { error: `Could not create species: ${error.message}` };
  }

  revalidatePath("/admin/species");
  redirect("/admin/species");
}

export async function updateSpecies(
  _prevState: SpeciesFormState,
  formData: FormData,
): Promise<SpeciesFormState> {
  const { supabase } = await requireAdmin();

  const speciesId = String(formData.get("species_id") ?? "");
  if (speciesId.length === 0) return { error: "Missing species id." };

  const parsed = readSpeciesFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("species").update(parsed.fields).eq("id", speciesId);
  if (error) {
    return { error: `Could not save species: ${error.message}` };
  }

  revalidatePath("/admin/species");
  redirect("/admin/species");
}
