import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminZonesPage() {
  const { supabase } = await requireAdmin();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, tier, is_tutorial, is_active")
    .order("tier")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Zones</h2>
        <Link
          href="/admin/zones/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New zone
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Zone</th>
              <th className="px-4 py-2">Tier</th>
              <th className="px-4 py-2">Tutorial</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(zones ?? []).map((zone) => (
              <tr
                key={zone.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/zones/${zone.id}`} className="hover:underline">
                    {zone.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{zone.tier}</td>
                <td className="px-4 py-2">{zone.is_tutorial ? "Yes" : "No"}</td>
                <td className="px-4 py-2">{zone.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(zones ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                  No zones yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
