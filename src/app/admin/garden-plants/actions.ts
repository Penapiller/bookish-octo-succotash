"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type GardenPlantFormState = { error: string } | null;

function readGardenPlantFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const imageStage1 = String(formData.get("image_stage1_url") ?? "").trim();
  const imageStage2 = String(formData.get("image_stage2_url") ?? "").trim();
  const imageStage3 = String(formData.get("image_stage3_url") ?? "").trim();
  const produceItemId = String(formData.get("produce_item_id") ?? "").trim();
  const qtyMinRaw = String(formData.get("produce_quantity_min") ?? "");
  const qtyMaxRaw = String(formData.get("produce_quantity_max") ?? "");
  const coinYieldRaw = String(formData.get("base_coin_yield") ?? "");
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };

  const qtyMin = Number(qtyMinRaw);
  const qtyMax = Number(qtyMaxRaw);
  const coinYield = Number(coinYieldRaw);

  if (!Number.isInteger(qtyMin) || qtyMin < 1) {
    return { ok: false as const, error: "Min produce quantity must be a whole number of at least 1." };
  }
  if (!Number.isInteger(qtyMax) || qtyMax < qtyMin) {
    return { ok: false as const, error: "Max produce quantity must be a whole number no smaller than the min." };
  }
  if (!Number.isInteger(coinYield) || coinYield < 0) {
    return { ok: false as const, error: "Base coin yield must be a non-negative whole number." };
  }

  return {
    ok: true as const,
    fields: {
      name,
      image_stage1_url: imageStage1.length > 0 ? imageStage1 : null,
      image_stage2_url: imageStage2.length > 0 ? imageStage2 : null,
      image_stage3_url: imageStage3.length > 0 ? imageStage3 : null,
      produce_item_id: produceItemId.length > 0 ? produceItemId : null,
      produce_quantity_min: qtyMin,
      produce_quantity_max: qtyMax,
      base_coin_yield: coinYield,
      is_active: isActive,
    },
  };
}

export async function createGardenPlant(
  _prevState: GardenPlantFormState,
  formData: FormData,
): Promise<GardenPlantFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readGardenPlantFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("garden_plants").insert(parsed.fields);
  if (error) {
    return { error: `Could not create plant: ${error.message}` };
  }

  revalidatePath("/admin/garden-plants");
  redirect("/admin/garden-plants");
}

export async function updateGardenPlant(
  _prevState: GardenPlantFormState,
  formData: FormData,
): Promise<GardenPlantFormState> {
  const { supabase } = await requireAdmin();

  const plantId = String(formData.get("plant_id") ?? "");
  if (plantId.length === 0) return { error: "Missing plant id." };

  const parsed = readGardenPlantFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("garden_plants").update(parsed.fields).eq("id", plantId);
  if (error) {
    return { error: `Could not save plant: ${error.message}` };
  }

  revalidatePath("/admin/garden-plants");
  redirect("/admin/garden-plants");
}
