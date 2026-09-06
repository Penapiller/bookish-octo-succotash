import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SupportTicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .eq("player_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <Link
          href="/support/new"
          className="rounded-md bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
        >
          + New ticket
        </Link>
      </div>

      {(tickets ?? []).length === 0 ? (
        <p className="text-sm italic text-stone-500">No support tickets yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(tickets ?? []).map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 px-4 py-2.5 text-sm hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <span className="font-medium">{ticket.subject}</span>
                <span className={ticket.status === "open" ? "text-amber-700 dark:text-amber-300" : "text-stone-500"}>
                  {ticket.status === "open" ? "Open" : "Closed"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
