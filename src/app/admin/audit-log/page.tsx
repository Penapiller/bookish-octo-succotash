import { requireAdmin } from "@/lib/admin";

type AuditLogEntryRow = {
  id: string;
  admin_user_id: string | null;
  action_type: string;
  target_table: string;
  target_id: string;
  change_summary: unknown;
  created_at: string;
  users: { display_name: string; email: string } | null;
};

const PAGE_SIZE = 50;

export default async function AdminAuditLogPage() {
  const { supabase } = await requireAdmin();

  // The embedded users(...) row only resolves for admin_user_id = the
  // querying admin's own id — RLS on users only permits auth.uid() = id.
  // Fine today since this app has exactly one admin; would need a wider
  // users-select policy (or a view) if a second admin is ever added.
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_user_id, action_type, target_table, target_id, change_summary, created_at, users(display_name, email)")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const entries = (data ?? []) as unknown as AuditLogEntryRow[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Audit log</h2>
        <p className="text-sm text-stone-500">
          Every admin-panel write to zones, items, species, and potion recipes, most recent
          first. Read-only — the {PAGE_SIZE} most recent entries.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <details
            key={entry.id}
            className="rounded-lg border border-amber-200 p-3 text-sm dark:border-stone-800"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-medium uppercase text-xs tracking-wide text-stone-500">
                {entry.action_type}
              </span>
              <span className="font-medium">{entry.target_table}</span>
              <span className="text-stone-500">
                by {entry.users?.display_name ?? entry.admin_user_id ?? "unknown"}
              </span>
              <span className="ml-auto text-xs text-stone-500">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-amber-100 p-3 text-xs dark:bg-stone-900">
              {JSON.stringify(entry.change_summary, null, 2)}
            </pre>
          </details>
        ))}
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">No admin actions logged yet.</p>
        ) : null}
      </div>
    </div>
  );
}
