"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import { ClaimRewardModal } from "@/components/claim-reward-modal";
import type {
  ActiveExpeditionSummary,
  ExplorableZone,
  PetWithSpecies,
} from "@/lib/supabase/types";

// Single sitewide map background — not zone-specific, so it isn't stored
// per-row in the database (see zones.map_x/y/width/height for the
// per-zone hotspot placement over this image).
const MAP_IMAGE_URL =
  "https://placehold.co/1200x800/1a2e1a/FFFFFF/png?text=Expedition+Map+%28Placeholder%29";

export function ExpeditionMap({
  zones,
  pets,
  activeExpeditions,
}: {
  zones: ExplorableZone[];
  pets: PetWithSpecies[];
  activeExpeditions: ActiveExpeditionSummary[];
}) {
  const router = useRouter();
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [usePotion, setUsePotion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimTarget, setClaimTarget] = useState<{ expeditionId: string; zoneName: string } | null>(
    null,
  );

  // The sent pet stays busy, and its zone stays locked, through
  // awaiting_claim too — see the one-expedition-per-zone comment on
  // start_expedition in supabase/migrations/0004_expedition_claim_flow.sql.
  const busyPetIds = useMemo(
    () => new Set(activeExpeditions.map((e) => e.pet_id)),
    [activeExpeditions],
  );

  // At most one entry per zone, enforced server-side — a Map is just a
  // convenient zone_id -> expedition lookup, not modeling "many per zone".
  const activeByZone = useMemo(() => {
    const map = new Map<string, ActiveExpeditionSummary>();
    for (const exp of activeExpeditions) {
      map.set(exp.zone_id, exp);
    }
    return map;
  }, [activeExpeditions]);

  const petsById = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const availablePets = pets.filter((p) => !busyPetIds.has(p.id));

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedZoneActive = selectedZoneId ? activeByZone.get(selectedZoneId) : undefined;

  function openZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    setError(null);
    setUsePotion(false);
    const firstAvailable = pets.find((p) => !busyPetIds.has(p.id));
    setSelectedPetId(firstAvailable?.id ?? "");
  }

  async function handleStart() {
    if (!selectedZoneId || !selectedPetId) return;
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired — please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("start_expedition", {
      p_user_id: user.id,
      p_pet_id: selectedPetId,
      p_zone_id: selectedZoneId,
      p_use_potion: usePotion,
    });

    setIsSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSelectedZoneId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <Image
          src={MAP_IMAGE_URL}
          alt="Expedition map"
          fill
          sizes="(min-width: 896px) 800px, 100vw"
          className="object-cover"
          priority
        />
        {zones.map((zone) => {
          const active = activeByZone.get(zone.id);
          if (zone.map_x === null || zone.map_y === null || zone.map_width === null || zone.map_height === null) {
            return null;
          }
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => openZone(zone.id)}
              onMouseEnter={() => setHoveredZoneId(zone.id)}
              onMouseLeave={() => setHoveredZoneId(null)}
              onFocus={() => setHoveredZoneId(zone.id)}
              onBlur={() => setHoveredZoneId(null)}
              aria-label={`View ${zone.name}`}
              className="absolute overflow-hidden rounded focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
              style={{
                left: `${zone.map_x}%`,
                top: `${zone.map_y}%`,
                width: `${zone.map_width}%`,
                height: `${zone.map_height}%`,
              }}
            >
              {zone.image_url ? (
                <Image
                  src={zone.image_url}
                  alt=""
                  fill
                  sizes="400px"
                  className={`object-cover transition-opacity duration-200 ${
                    hoveredZoneId === zone.id || selectedZoneId === zone.id
                      ? "opacity-90"
                      : "opacity-0"
                  }`}
                />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-xs font-medium text-white">
                {zone.name}
              </span>
              {active?.status === "awaiting_claim" ? (
                <span className="absolute right-1 top-1 animate-pulse rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">
                  Ready!
                </span>
              ) : active ? (
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5">
                  <ExpeditionCountdown resolvesAt={active.resolves_at} compact />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedZone ? (
        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {selectedZone.name}{" "}
                <span className="text-sm font-normal text-zinc-500">Tier {selectedZone.tier}</span>
              </h2>
              <p className="text-sm text-zinc-500">
                {selectedZone.description ??
                  "This box is meant to hold this zone's flavor description."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedZoneId(null)}
              className="text-sm text-zinc-500 hover:underline"
            >
              Close
            </button>
          </div>

          {selectedZone.pool.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium">You might get:</h3>
              <ul className="mt-2 flex flex-wrap gap-3">
                {selectedZone.pool.map((species) => (
                  <li key={species.id} className="flex flex-col items-center gap-1 text-center">
                    {species.image_url ? (
                      <Image
                        src={species.image_url}
                        alt={species.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
                    )}
                    <span className="text-xs">{species.name}</span>
                    <span className="text-xs capitalize text-zinc-500">{species.rarity}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedZoneActive?.status === "awaiting_claim" ? (
            <div className="flex flex-col items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
              <p className="font-medium">
                {petsById.get(selectedZoneActive.pet_id)?.species?.name ?? "Your pet"} has
                returned!
              </p>
              <button
                type="button"
                onClick={() =>
                  setClaimTarget({
                    expeditionId: selectedZoneActive.id,
                    zoneName: selectedZone.name,
                  })
                }
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Claim reward
              </button>
            </div>
          ) : selectedZoneActive ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
              <span>
                {petsById.get(selectedZoneActive.pet_id)?.species?.name ?? "A pet"} is exploring
                here
              </span>
              <ExpeditionCountdown resolvesAt={selectedZoneActive.resolves_at} />
            </div>
          ) : availablePets.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">
              All of your pets are already out on an expedition.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pet-select" className="text-sm font-medium">
                  Send which pet?
                </label>
                <select
                  id="pet-select"
                  value={selectedPetId}
                  onChange={(e) => setSelectedPetId(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {availablePets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.species?.name ?? "Unnamed pet"} ({pet.rarity})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={usePotion}
                  onChange={(e) => setUsePotion(e.target.checked)}
                />
                Use a potion boost (testing only — real potions arrive in a
                later update; this just shortens the expedition timer)
              </label>

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              <button
                type="button"
                onClick={handleStart}
                disabled={isSubmitting || !selectedPetId}
                className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isSubmitting ? "Starting…" : "Start expedition"}
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          Hover an area to preview it, then click to see details and send a pet.
        </p>
      )}

      {claimTarget ? (
        <ClaimRewardModal
          expeditionId={claimTarget.expeditionId}
          zoneName={claimTarget.zoneName}
          onClose={() => setClaimTarget(null)}
        />
      ) : null}
    </div>
  );
}
