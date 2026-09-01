"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Ticks down to `resolvesAt` and refreshes the current route (re-running
 * the server component's data fetch, which calls resolve_due_expeditions)
 * once the timer hits zero — no polling or push needed for a single
 * client-visible timer.
 *
 * `remainingMs` starts as `null` and is only ever computed inside
 * useEffect (client-only, post-mount). If it were computed during render
 * instead, the server's Date.now() and the client's Date.now() at
 * hydration time would differ by however long the response took to reach
 * the browser, so the very first client render would produce different
 * text than what the server sent — a hydration mismatch. Server render
 * and the first client render both show the same "Loading…" placeholder;
 * the real countdown only appears after mount.
 */
export function ExpeditionCountdown({
  resolvesAt,
  compact = false,
}: {
  resolvesAt: string;
  /** Bare "M:SS" with no wrapping sentence, for tight spaces like a map badge. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(resolvesAt).getTime();

    const tick = () => {
      const next = target - Date.now();
      setRemainingMs(next);
      return next;
    };

    if (tick() <= 0) {
      return;
    }

    const interval = setInterval(() => {
      if (tick() <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [resolvesAt, router]);

  if (remainingMs === null) {
    return compact ? (
      <span className="text-xs font-medium text-white">…</span>
    ) : (
      <p className="text-sm text-zinc-500">Loading…</p>
    );
  }

  if (remainingMs <= 0) {
    return compact ? (
      <span className="text-xs font-medium text-white">…</span>
    ) : (
      <p className="text-sm text-zinc-500">Wrapping up…</p>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return compact ? (
    <span className="text-xs font-medium text-white">{label}</span>
  ) : (
    <p className="text-sm text-zinc-500">Ready in {label}</p>
  );
}
