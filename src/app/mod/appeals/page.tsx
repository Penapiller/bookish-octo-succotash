import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { ReviewAppealForm } from "./review-appeal-form";
import type { AppealStatus, BanType } from "@/lib/supabase/types";

const BAN_TYPE_LABELS: Record<BanType, string> = {
  dm: "DM ban",
  sales: "Sales ban",
  forums: "Forums ban",
  account: "Account ban",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// "Ideally, the person reviewing the appeal isn't the person who made
// the original decision" — the real gate is appeals' own UPDATE policy
// (0031_moderation_overhaul.sql), which rejects the issuing staff
// member's review outright; this page just doesn't render the
// approve/deny controls for them in the first place; a note explains why
// instead.
export default async function ModAppealsPage(props: PageProps<"/mod/appeals">) {
  const { supabase, user } = await requireModerator();
  const searchParams = await props.searchParams;
  const statusParam = first(searchParams.status);
  const activeStatus: AppealStatus = statusParam === "closed" ? "approved" : "open";

  const { data: appealsData } = await supabase
    .from("appeals")
    .select("*")
    .eq("status", activeStatus === "open" ? "open" : "approved")
    .order("created_at", { ascending: activeStatus === "open" });

  // "Closed" covers both approved and denied — fetch denied ones too when
  // that tab is active and merge, since a single .eq() can't express "in
  // one of two statuses" alongside the open-tab's simpler single value.
  const { data: deniedData } =
    activeStatus !== "open"
      ? await supabase.from("appeals").select("*").eq("status", "denied").order("created_at", { ascending: false })
      : { data: [] };

  const appeals = [...(appealsData ?? []), ...(deniedData ?? [])];

  const banIds = [...new Set(appeals.map((a) => a.ban_id))];
  const { data: bansData } =
    banIds.length > 0 ? await supabase.from("bans").select("*").in("id", banIds) : { data: [] };
  const banById = new Map((bansData ?? []).map((b) => [b.id, b]));

  const userIds = [
    ...new Set(
      [
        ...appeals.map((a) => a.player_id),
        ...(bansData ?? []).map((b) => b.issued_by),
      ].filter((id): id is string => id !== null),
    ),
  ];
  const { data: profilesData } =
    userIds.length > 0 ? await supabase.from("user_profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-amber-200 dark:border-stone-800">
        <Link
          href="/mod/appeals?status=open"
          className={`border-b-2 px-3 py-2 text-sm ${
            activeStatus === "open"
              ? "border-amber-800 font-medium dark:border-amber-200"
              : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
          }`}
        >
          Open
        </Link>
        <Link
          href="/mod/appeals?status=closed"
          className={`border-b-2 px-3 py-2 text-sm ${
            activeStatus !== "open"
              ? "border-amber-800 font-medium dark:border-amber-200"
              : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
          }`}
        >
          Closed
        </Link>
      </nav>

      {appeals.length === 0 ? (
        <p className="text-sm italic text-stone-500">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {appeals.map((appeal) => {
            const ban = banById.get(appeal.ban_id);
            const canReview = ban && ban.issued_by !== user.id;
            return (
              <li key={appeal.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
                <p className="text-sm">
                  <Link href={`/mod/players/${appeal.player_id}`} className="font-medium hover:underline">
                    {nameById.get(appeal.player_id) ?? "Unknown"}
                  </Link>{" "}
                  appealed their {ban ? (BAN_TYPE_LABELS[ban.ban_type] ?? ban.ban_type) : "ban"}
                </p>
                {ban ? (
                  <p className="text-xs text-stone-500">
                    Issued by {nameById.get(ban.issued_by) ?? "Unknown"} — expires{" "}
                    {new Date(ban.expires_at).toLocaleString()}
                  </p>
                ) : null}
                <p className="text-sm text-stone-600 dark:text-stone-400">&ldquo;{appeal.reason}&rdquo;</p>
                {appeal.status !== "open" ? (
                  <p className="text-xs text-stone-500">
                    {appeal.status === "approved" ? "Approved" : "Denied"}
                    {appeal.reviewed_at ? ` at ${new Date(appeal.reviewed_at).toLocaleString()}` : ""}
                    {appeal.review_note ? ` — ${appeal.review_note}` : ""}
                  </p>
                ) : canReview ? (
                  <ReviewAppealForm appealId={appeal.id} banId={appeal.ban_id} />
                ) : (
                  <p className="text-xs italic text-stone-500">
                    You issued this ban and can&apos;t review its appeal.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
