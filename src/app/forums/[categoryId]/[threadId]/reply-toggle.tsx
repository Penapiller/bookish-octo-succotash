"use client";

import { useState } from "react";
import { Reply } from "lucide-react";

/**
 * Keeps the reply box out of the way until a player actually wants to
 * reply — the form only mounts (and BBCodeEditor's toolbar/textarea
 * only render) once they click the button.
 */
export function ReplyToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  if (open) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 self-start rounded-md bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
    >
      <Reply size={18} />
      Reply
    </button>
  );
}
