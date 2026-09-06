import { liftBan } from "../../actions";
import type { BanWithIssuer, BanType } from "@/lib/supabase/types";

const BAN_TYPE_LABELS: Record<BanType, string> = {
  dm: "DM ban",
  sales: "Sales ban",
  forums: "Forums ban",
  account: "Account ban",
};

// Active AND past bans, so staff can see the player's full ban history at
// a glance — not just what's currently in effect. Lifting is a plain
// form action (see liftBan, mod/actions.ts); the update policy's own
// ban-type/role check is what actually stops a moderator from lifting an
// account ban, this UI just doesn't hide the button since a moderator
// might still reasonably want to try lifting one of their own bans.
export function BansList({ bans, targetUserId }: { bans: BanWithIssuer[]; targetUserId: string }) {
  if (bans.length === 0) {
    return <p className="text-sm italic text-stone-500">No bans on record.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {bans.map((ban) => {
        const isActive = !ban.lifted_at && new Date(ban.expires_at) > new Date();
        return (
          <li
            key={ban.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 px-4 py-2.5 text-sm dark:border-stone-800"
          >
            <div>
              <p>
                <span className="font-medium">{BAN_TYPE_LABELS[ban.ban_type]}</span>{" "}
                <span
                  className={
                    isActive
                      ? "text-red-600 dark:text-red-400"
                      : "text-stone-500"
                  }
                >
                  {isActive ? "Active" : ban.lifted_at ? "Lifted early" : "Expired"}
                </span>
              </p>
              <p className="text-xs text-stone-500">
                Issued by {ban.issuedByName} on {new Date(ban.issued_at).toLocaleString()} — expires{" "}
                {new Date(ban.expires_at).toLocaleString()}
              </p>
              {ban.reason ? <p className="text-xs italic text-stone-500">&ldquo;{ban.reason}&rdquo;</p> : null}
            </div>
            {isActive ? (
              <form action={liftBan}>
                <input type="hidden" name="ban_id" value={ban.id} />
                <input type="hidden" name="target_user_id" value={targetUserId} />
                <button
                  type="submit"
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-stone-700 dark:hover:bg-stone-900"
                >
                  Lift ban
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
