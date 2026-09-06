import Link from "next/link";
import { requireModerator } from "@/lib/moderation";

export default async function ModDashboardPage() {
  const { supabase } = await requireModerator();

  const [{ count: openCount }, { count: resolvedCount }, { count: dismissedCount }] = await Promise.all([
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "dismissed"),
  ]);

  const cards = [
    { href: "/mod/reports?status=open", label: "Open reports", count: openCount ?? 0 },
    { href: "/mod/reports?status=resolved", label: "Resolved", count: resolvedCount ?? 0 },
    { href: "/mod/reports?status=dismissed", label: "Dismissed", count: dismissedCount ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="flex flex-col gap-1 rounded-lg border border-amber-200 p-4 hover:bg-amber-100 dark:border-stone-800 dark:hover:bg-stone-900"
        >
          <span className="text-2xl font-semibold tracking-tight">{card.count}</span>
          <span className="text-sm text-stone-500">{card.label}</span>
        </Link>
      ))}
    </div>
  );
}
