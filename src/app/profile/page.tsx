import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import type { ExpeditionWithZone, PetWithSpecies } from "@/lib/supabase/types";

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

  const [{ data: petsData }, { data: expeditionsData }] = await Promise.all([
    supabase
      .from("pets")
      .select("id, rarity, color_variant, created_at, species(name, image_url)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("expeditions")
      .select("id, status, is_tutorial, resolves_at, zones(name, description, image_url)")
      .eq("user_id", user.id)
      .eq("status", "in_progress"),
  ]);

  // Hand-cast: see the comment on PetWithSpecies/ExpeditionWithZone in
  // lib/supabase/types.ts for why these joined selects aren't inferred.
  const pets = (petsData ?? []) as unknown as PetWithSpecies[];
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
            className="rounded-full"
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

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Currency</dt>
          <dd className="text-lg font-medium">{profile.currency_balance}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Den size</dt>
          <dd className="text-lg font-medium">{profile.den_size}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pets owned</dt>
          <dd className="text-lg font-medium">
            {pets.length} / {profile.den_size}
          </dd>
        </div>
      </dl>

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
                  className="rounded"
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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Your pets</h2>
        {pets.length === 0 ? (
          <p className="text-zinc-500 italic">
            You don&apos;t have any pets yet. This shouldn&apos;t normally
            happen — try refreshing the page.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pets.map((pet) => (
              <li
                key={pet.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800"
              >
                {pet.species?.image_url ? (
                  <Image
                    src={pet.species.image_url}
                    alt={pet.species?.name ?? ""}
                    width={96}
                    height={96}
                    className="rounded"
                  />
                ) : (
                  <div className="h-24 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                )}
                <p className="text-sm font-medium">{pet.species?.name}</p>
                <p className="text-xs capitalize text-zinc-500">{pet.rarity}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
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
