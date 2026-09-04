import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { NavGroups, type NavGroup } from "@/components/nav-groups";

export async function SiteNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = profile?.is_admin ?? false;

  const groups: NavGroup[] = [
    {
      label: "Play",
      links: [
        { href: "/expeditions", label: "Expeditions" },
        { href: "/brewing", label: "Brewing" },
      ],
    },
    {
      label: "My Stuff",
      links: [
        { href: "/pets", label: "Pets" },
        { href: "/items", label: "Items" },
      ],
    },
    {
      label: "Trade",
      links: [
        { href: "/marketplace", label: "Marketplace" },
        ...(TRADING_ENABLED ? [{ href: "/trades", label: "Trades" }] : []),
      ],
    },
    {
      label: "Community",
      links: [
        { href: "/forums", label: "Forums" },
        { href: "/messages", label: "Messages" },
      ],
    },
    {
      label: "Account",
      links: [
        { href: "/settings", label: "Settings" },
        ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ],
    },
  ];

  return (
    <nav className="mx-4 mt-3 rounded-md bg-yellow-400 px-3 py-1.5 shadow-sm">
      <NavGroups groups={groups} />
    </nav>
  );
}
