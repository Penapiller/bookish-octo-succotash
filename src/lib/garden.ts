import type { GardenPlantingRow } from "./supabase/types";

const WATER_INTERVAL_MS = 8 * 60 * 60 * 1000;
const WILT_GRACE_MS = 72 * 60 * 60 * 1000;

export type GardenPlantingDisplay = {
  stage: 1 | 2 | 3;
  needsWater: boolean;
  isReady: boolean;
  isWilted: boolean;
  progressFraction: number; // 0-1, for a progress bar
};

// Pure derivation from a planting's raw timestamps — no DB round trip.
// Mirrors resolve_due_garden()'s own ready/wilted logic (see that
// function's comment in 0035_gardening.sql) so the UI's "needs water" /
// stage indicators agree with what a page reload (which calls
// resolve_due_garden first) will actually show, without waiting for
// that reload — this only ever reads timestamps already in hand, it
// doesn't decide the stored `status`.
export function getGardenPlantingDisplay(
  planting: Pick<
    GardenPlantingRow,
    "status" | "next_water_needed_at" | "grow_completes_at" | "total_duration_seconds"
  >,
  now: Date = new Date(),
): GardenPlantingDisplay {
  const nowMs = now.getTime();
  const nextWaterNeededMs = new Date(planting.next_water_needed_at).getTime();
  const growCompletesMs = new Date(planting.grow_completes_at).getTime();
  const totalDurationMs = planting.total_duration_seconds * 1000;

  const isWilted = planting.status === "wilted";
  const isReady = planting.status === "ready";
  const needsWater = planting.status === "growing" && nowMs > nextWaterNeededMs;

  // Effective "clock time" for progress purposes freezes at
  // next_water_needed_at once overdue, instead of continuing to advance
  // with real time — see getGardenPlantingDisplay's module comment.
  const effectiveNowMs = Math.min(nowMs, nextWaterNeededMs);
  const remainingMs = Math.max(0, growCompletesMs - effectiveNowMs);
  const progressFraction = isReady
    ? 1
    : Math.max(0, Math.min(1, 1 - remainingMs / totalDurationMs));

  const stage: 1 | 2 | 3 = isReady || progressFraction >= 2 / 3 ? 3 : progressFraction >= 1 / 3 ? 2 : 1;

  return { stage, needsWater, isReady, isWilted, progressFraction };
}

// How much time is left before an overdue-but-not-yet-watered plant
// wilts — for a countdown in the UI. Null once it's no longer overdue
// (nothing to count down) or already wilted/ready.
export function getWiltCountdownMs(
  planting: Pick<GardenPlantingRow, "status" | "next_water_needed_at">,
  now: Date = new Date(),
): number | null {
  if (planting.status !== "growing") return null;
  const nextWaterNeededMs = new Date(planting.next_water_needed_at).getTime();
  const nowMs = now.getTime();
  if (nowMs <= nextWaterNeededMs) return null;
  return Math.max(0, nextWaterNeededMs + WILT_GRACE_MS - nowMs);
}

// When the next watering becomes possible again (the 8h rate limit) —
// null if it's already waterable now.
export function getNextWaterableAt(lastWateredAt: string): Date | null {
  const nextWaterableMs = new Date(lastWateredAt).getTime() + WATER_INTERVAL_MS;
  return nextWaterableMs > Date.now() ? new Date(nextWaterableMs) : null;
}

// Mirrors the cost curve in expand_garden() (0035_gardening.sql) exactly
// — display-only, the RPC re-derives and enforces the real cost
// server-side regardless of what this shows. Same "300 * 1.5^n" shape as
// nextDenExpansionCost, just a cheaper base for a smaller capacity bump.
export function nextGardenExpansionCost(gardenRows: number): number {
  const rowsBought = Math.max(0, gardenRows - 3);
  return Math.round(300 * Math.pow(1.5, rowsBought));
}
