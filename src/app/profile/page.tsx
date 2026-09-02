import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.display_name}
          </h1>
          <p className="text-sm text-zinc-500">Joined {joined}</p>
        </div>
      </div>

      {profile.bio ? (
        <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {profile.bio}
        </p>
      ) : (
        <p className="text-zinc-500 italic">
          No bio yet.{" "}
          <Link href="/settings" className="underline">
            Add one
          </Link>
          .
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">🪙 Coins</dt>
          <dd className="text-lg font-medium">{profile.coin_balance}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">💎 Gems</dt>
          <dd className="text-lg font-medium">{profile.gem_balance}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Den size</dt>
          <dd className="text-lg font-medium">{profile.den_size}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pets owned</dt>
          <dd className="text-lg font-medium">
            {petCount ?? 0} / {profile.den_size}
          </dd>
        </div>
      </dl>

      <ExpandDenButton
        userId={user.id}
        cost={nextDenExpansionCost(profile.den_size)}
        canAfford={profile.coin_balance >= nextDenExpansionCost(profile.den_size)}
      />

      {activeExpeditions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Active expedition</h2>
          {activeExpeditions.map((expedition) => (
            <div
              key={expedition.id}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
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
                <p className="text-xs text-zinc-500">
                  {expedition.zones?.description ??
                    "This box is meant to hold this zone's flavor description."}
                </p>
                <ExpeditionCountdown resolvesAt={expedition.resolves_at} />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/pets"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          View pets
        </Link>
        <Link
          href="/items"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          View items
        </Link>
        <Link
          href="/settings"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Edit profile
        </Link>
        <Link
          href={`/u/${profile.id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          View public profile
        </Link>
      </div>
    </main>
  );
}
