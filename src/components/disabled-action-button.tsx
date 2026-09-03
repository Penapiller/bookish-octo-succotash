import type { LucideIcon } from "lucide-react";

/**
 * A visibly inert button for features that have a designed spot in the
 * layout but aren't built yet (friending, DMs, reporting, browsing
 * another player's collection). Same disabled/cursor-not-allowed/title
 * convention as the forum post Report button (src/app/forums/[categoryId]/
 * [threadId]/page.tsx) — grey it out rather than hide it, so the feature's
 * eventual home is already in place.
 */
export function DisabledActionButton({
  icon: Icon,
  label,
  title = "This isn't hooked up yet",
}: {
  icon: LucideIcon;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-400 dark:border-stone-700 dark:text-stone-600"
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
