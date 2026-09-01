"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Ticks down to `resolvesAt` and refreshes the current route (re-running
 * the server component's data fetch, which calls resolve_due_expeditions)
 * once the timer hits zero — no polling or push needed for a single
 * client-visible timer.
 */
export function ExpeditionCountdown({ resolvesAt }: { resolvesAt: string }) {
  const router = useRouter();
  const target = new Date(resolvesAt).getTime();
  const [remainingMs, setRemainingMs] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = target - Date.now();
      setRemainingMs(next);
      if (next <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [target, router]);

  if (remainingMs <= 0) {
    return <p className="text-sm text-zinc-500">Wrapping up…</p>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <p className="text-sm text-zinc-500">
      Ready in {minutes}:{seconds.toString().padStart(2, "0")}
    </p>
  );
}
