import { requireAdmin } from "@/lib/admin";
import { CurrencyGrantForm } from "./currency-grant-form";

export default async function AdminCurrencyPage() {
  const { supabase, user } = await requireAdmin();

  const { data: profile } = await supabase
    .from("users")
    .select("coin_balance, gem_balance")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Currency (testing)</h2>
        <p className="text-sm text-zinc-500">
          Grant coins or gems to your own account for testing. There&apos;s no real-money
          purchase flow yet — that&apos;s a later module — and no way from here (or anywhere in
          the app) to affect any account but your own.
        </p>
      </div>

      <dl className="flex gap-8 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div>
          <dt className="text-zinc-500">🪙 Coins</dt>
          <dd className="text-lg font-medium">{profile?.coin_balance ?? 0}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">💎 Gems</dt>
          <dd className="text-lg font-medium">{profile?.gem_balance ?? 0}</dd>
        </div>
      </dl>

      <CurrencyGrantForm />
    </div>
  );
}
