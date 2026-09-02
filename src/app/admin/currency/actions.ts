"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type CurrencyGrantState = { error: string } | { success: true } | null;

// Deliberately self-only (see admin_grant_self_currency in
// 0011_currency_and_den_expansion.sql) — there is no target-user
// parameter anywhere in this path, matching the "no in-app way to affect
// any account but my own" rule the rest of the admin panel follows.
export async function grantSelfCurrency(
  _prevState: CurrencyGrantState,
  formData: FormData,
): Promise<CurrencyGrantState> {
  const { supabase, user } = await requireAdmin();

  const coinDelta = Number(formData.get("coin_delta") ?? "0");
  const gemDelta = Number(formData.get("gem_delta") ?? "0");

  if (!Number.isInteger(coinDelta) || !Number.isInteger(gemDelta)) {
    return { error: "Amounts must be whole numbers." };
  }
  if (coinDelta === 0 && gemDelta === 0) {
    return { error: "Enter a non-zero coin or gem amount." };
  }

  const { error } = await supabase.rpc("admin_grant_self_currency", {
    p_admin_user_id: user.id,
    p_coin_delta: coinDelta,
    p_gem_delta: gemDelta,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/currency");
  revalidatePath("/profile");
  return { success: true };
}
