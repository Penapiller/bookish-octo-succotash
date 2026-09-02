import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTrades } from "../load-trades";
import { TradeCard } from "../trade-card";

export default async function TradeHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: idRows } = await supabase
    .from("trades")
    .select("id")
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .neq("status", "pending");

  const trades = await loadTrades(
    supabase,
    (idRows ?? []).map((r) => r.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trade history</h1>
        <p className="text-sm text-stone-500">
          <Link href="/trades" className="underline">
            Trading Center
          </Link>{" "}
          ·{" "}
          <Link href="/trades/active" className="underline">
            Active trades
          </Link>
        </p>
      </div>

      {trades.length === 0 ? (
        <p className="text-sm italic text-stone-500">
          No completed, declined, or cancelled trades yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} viewerId={user.id} />
          ))}
        </div>
      )}
    </main>
  );
}
