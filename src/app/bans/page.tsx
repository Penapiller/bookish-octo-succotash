import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppealForm } from "./appeal-form";
import type { AppealStatus, BanType } from "@/lib/supabase/types";

const BAN_TYPE_LABELS: Record<BanType, string> = {
  dm: "DM ban",
  sales: "Sales ban",
  forums: "Forums ban",
  account: "Account ban",
};

const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  open: "Appeal pending review",
  approved: "Appeal approved — ban lifted",
  denied: "Appeal denied",
};

// Relies entirely on bans' existing "Players can view their own bans"
// SELECT policy (0029_bans_and_staff_fixes.sql) — no new RLS needed here.
// Account bans show up in the list (for the player's own record) but
// never get an Appeal button — see appeals' INSERT policy, which
// rejects them outright, and the design note in 0031_moderation_
// overhaul.sql on why (no authenticated session survives an account ban
// to appeal from).
export default async function MyBansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bansData } = await supabase
    .from("bans")
    .select("*")
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });
  const bans = bansData ?? [];

  const banIds = bans.map((b) => b.id);
  const { data: appealsData } =
    banIds.length > 0
      ? await supabase.from("appeals").select("*").in("ban_id", banIds)
      : { data: [] };
  const appealByBanId = new Map((appealsData ?? []).map((a) => [a.ban_id, a]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Bans</h1>
        <p className="text-sm text-stone-500">Your restriction history. You can appeal a ban once, if you think it was a mistake.</p>
      </div>

      {bans.length === 0 ? (
        <p className="text-sm italic text-stone-500">No bans on record.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bans.map((ban) => {
            const isActive = !ban.lifted_at && new Date(ban.expires_at) > new Date();
            const appeal = appealByBanId.get(ban.id);
            return (
              <li key={ban.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{BAN_TYPE_LABELS[ban.ban_type]}</span>{" "}
                    <span className={isActive ? "text-red-600 dark:text-red-400" : "text-stone-500"}>
                      {isActive ? "Active" : ban.lifted_at ? "Lifted early" : "Expired"}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-stone-500">
                  Issued {new Date(ban.issued_at).toLocaleString()} — expires {new Date(ban.expires_at).toLocaleString()}
                </p>
                {ban.reason ? <p className="text-xs italic text-stone-500">&ldquo;{ban.reason}&rdquo;</p> : null}
                {ban.ban_type !== "account" ? (
                  appeal ? (
                    <p className="text-xs text-stone-500">{APPEAL_STATUS_LABELS[appeal.status]}</p>
                  ) : (
                    <AppealForm banId={ban.id} />
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
