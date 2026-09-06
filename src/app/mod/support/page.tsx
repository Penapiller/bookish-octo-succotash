import Link from "next/link";
import { requireModerator } from "@/lib/moderation";

type Tab = "unclaimed" | "mine" | "closed";

const TABS: { value: Tab; label: string }[] = [
  { value: "unclaimed", label: "Unclaimed" },
  { value: "mine", label: "Mine" },
  { value: "closed", label: "Closed" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ModSupportPage(props: PageProps<"/mod/support">) {
  const { supabase, user } = await requireModerator();
  const searchParams = await props.searchParams;
  const tabParam = first(searchParams.tab);
  const activeTab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : "unclaimed";

  let query = supabase.from("support_tickets").select("id, player_id, subject, status, claimed_by, created_at");
  if (activeTab === "unclaimed") {
    query = query.eq("status", "open").is("claimed_by", null);
  } else if (activeTab === "mine") {
    query = query.eq("status", "open").eq("claimed_by", user.id);
  } else {
    query = query.eq("status", "closed");
  }
  query = query.order("created_at", { ascending: activeTab !== "closed" });

  const { data: ticketsData } = await query;
  const tickets = ticketsData ?? [];

  const playerIds = [...new Set(tickets.map((t) => t.player_id))];
  const { data: profiles } =
    playerIds.length > 0 ? await supabase.from("user_profiles").select("id, display_name").in("id", playerIds) : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-amber-200 dark:border-stone-800">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/support?tab=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === tab.value
                ? "border-amber-800 font-medium dark:border-amber-200"
                : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {tickets.length === 0 ? (
        <p className="text-sm italic text-stone-500">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/mod/support/${ticket.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 px-4 py-2.5 text-sm hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <span>
                  <span className="font-medium">{ticket.subject}</span>{" "}
                  <span className="text-stone-500">— {nameById.get(ticket.player_id) ?? "Unknown"}</span>
                </span>
                <span className="text-xs text-stone-500">{new Date(ticket.created_at).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
