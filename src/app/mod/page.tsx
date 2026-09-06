import Link from "next/link";
import { requireModerator } from "@/lib/moderation";

export default async function ModDashboardPage() {
  const { supabase, user } = await requireModerator();
  const { data: viewerProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = viewerProfile?.is_admin ?? false;

  const [{ count: unclaimedCount }, { count: mineCount }, { count: needsAdminCount }, { count: closedCount }] =
    await Promise.all([
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open").is("claimed_by", null),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open").eq("claimed_by", user.id),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "escalated"),
      supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .in("status", ["resolved", "dismissed"]),
    ]);

  const cards = [
    { href: "/mod/reports?tab=unclaimed", label: "Unclaimed", count: unclaimedCount ?? 0 },
    { href: "/mod/reports?tab=mine", label: "Mine", count: mineCount ?? 0 },
    ...(isAdmin ? [{ href: "/mod/reports?tab=needs_admin", label: "Needs Admin", count: needsAdminCount ?? 0 }] : []),
    { href: "/mod/reports?tab=closed", label: "Closed", count: closedCount ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
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
