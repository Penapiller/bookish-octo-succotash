import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PawPrint, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bbcodeToHtml } from "@/lib/bbcode";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import { ExpandDenButton } from "./expand-den-button";
import type { ExpeditionWithZone } from "@/lib/supabase/types";

// Mirrors the cost curve in expand_den() (0011_currency_and_den_expansion.sql)
// exactly — display-only, the RPC re-derives and enforces the real cost
// server-side regardless of what this shows.
function nextDenExpansionCost(denSize: number): number {
  const expansionsBought = Math.max(0, Math.floor((denSize - 25) / 25));
  return Math.round(500 * Math.pow(1.5, expansionsBought));
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Failed to load profile for the signed-in user.");
  }

  // First-ever visit: grants the free starter pet + starts its one-time,
  // fixed-length tutorial expedition. A no-op on every later visit
  // (guarded server-side by users.starter_granted).
  await supabase.rpc("grant_starter_pet_and_tutorial", { p_user_id: user.id });
  // Lazily resolves any expedition whose timer has already elapsed —
  // there's no background job in this phase, so this runs on every load.
  await supabase.rpc("resolve_due_expeditions", { p_user_id: user.id });

  const [{ count: petCount }, { data: expeditionsData }] = await Promise.all([
    supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("expeditions")
      .select("id, status, is_tutorial, resolves_at, zones(name, description, image_url)")
      .eq("user_id", user.id)
      .eq("status", "in_progress"),
  ]);

  // Hand-cast: see the comment on ExpeditionWithZone in
  // lib/supabase/types.ts for why this joined select isn't inferred.
  const activeExpeditions = (expeditionsData ?? []) as unknown as ExpeditionWithZone[];
  const denExpansionCost = nextDenExpansionCost(profile.den_size);

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <div className="h-[72px] w-[72px] shrink-0 rounded-full bg-amber-200 dark:bg-stone-800" />
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.display_name}
              </h1>
              <p className="text-sm text-stone-500">Joined {joined}</p>
              <Link href="/settings" className="text-sm underline">
                Edit profile
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Player stats
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-stone-500">🪙 Coins</dt>
                <dd className="text-lg font-medium">{profile.coin_balance}</dd>
              </div>
              <div>
                <dt className="text-stone-500">💎 Gems</dt>
                <dd className="text-lg font-medium">{profile.gem_balance}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Den size</dt>
                <dd className="text-lg font-medium">{profile.den_size}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Pets owned</dt>
                <dd className="text-lg font-medium">
                  {petCount ?? 0} / {profile.den_size}
                </dd>
              </div>
            </dl>
            <ExpandDenButton
              userId={user.id}
              cost={denExpansionCost}
              canAfford={profile.coin_balance >= denExpansionCost}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Active expedition
            </h2>
            {activeExpeditions.length > 0 ? (
              activeExpeditions.map((expedition) => (
                <div key={expedition.id} className="flex items-center gap-4">
                  {expedition.zones?.image_url ? (
                    <Image
                      src={expedition.zones.image_url}
                      alt=""
                      width={64}
                      height={48}
                      className="h-12 w-16 rounded"
                    />
                  ) : null}
                  <div>
                    <p className="font-medium">
                      {expedition.is_tutorial ? "Tutorial expedition" : expedition.zones?.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {expedition.zones?.description ??
                        "This box is meant to hold this zone's flavor description."}
                    </p>
                    <ExpeditionCountdown resolvesAt={expedition.resolves_at} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">
                No expedition in progress.{" "}
                <Link href="/expeditions" className="underline">
                  Send a pet out
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              My stuff
            </h2>
            <div className="flex gap-3">
              <Link
                href="/pets"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-300 px-3 py-2 text-sm hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                <PawPrint size={16} />
                Pets
              </Link>
              <Link
                href="/items"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-300 px-3 py-2 text-sm hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                <Package size={16} />
                Items
              </Link>
            </div>
          </div>

          <div className="flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Bio</h2>
            {profile.bio ? (
              // bbcodeToHtml() is the only thing ever allowed to turn user
              // text into HTML — see src/lib/bbcode.ts. Runs fresh on every
              // render; profile.bio is raw BBCode source, never rendered
              // directly.
              <div
                className="forum-content text-stone-700 dark:text-stone-300"
                dangerouslySetInnerHTML={{ __html: bbcodeToHtml(profile.bio) }}
              />
            ) : (
              <p className="text-stone-500 italic">
                No bio yet.{" "}
                <Link href="/settings" className="underline">
                  Add one
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/u/${profile.id}`}
        className="self-start rounded-md border border-amber-300 px-4 py-2 text-sm hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        View public profile
      </Link>
    </main>
  );
}
