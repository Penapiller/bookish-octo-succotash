import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTrades } from "./load-trades";
import { TradeCard } from "./trade-card";
import type { TradeWithParticipants } from "@/lib/supabase/types";

function TradeSection({
  title,
  emptyText,
  trades,
  viewerId,
}: {
  title: string;
  emptyText: string;
  trades: TradeWithParticipants[];
  viewerId: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        {title} ({trades.length})
      </h2>
      {trades.length === 0 ? (
        <p className="text-sm italic text-stone-500">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} viewerId={viewerId} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function TradesPage() {
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
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`);

  const trades = await loadTrades(
    supabase,
    (idRows ?? []).map((r) => r.id),
  );

  const incoming = trades.filter((t) => t.recipientId === user.id && t.status === "pending");
  const outgoing = trades.filter((t) => t.initiatorId === user.id && t.status === "pending");
  const history = trades.filter((t) => t.status !== "pending");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="text-sm text-stone-500">
            Trade pets, items, coins, and gems with other players.
          </p>
        </div>
        <Link
          href="/trades/new"
          className="rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          Propose a trade
        </Link>
      </div>

      <TradeSection
        title="Incoming"
        emptyText="No trade offers waiting on you."
        trades={incoming}
        viewerId={user.id}
      />
      <TradeSection
        title="Outgoing"
        emptyText="You haven't proposed any trades."
        trades={outgoing}
        viewerId={user.id}
      />
      <TradeSection
        title="History"
        emptyText="No completed, declined, or cancelled trades yet."
        trades={history}
        viewerId={user.id}
      />
    </main>
  );
}
