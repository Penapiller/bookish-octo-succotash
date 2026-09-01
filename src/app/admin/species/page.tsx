import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminSpeciesPage() {
  const { supabase } = await requireAdmin();

  const { data: species } = await supabase
    .from("species")
    .select("id, name, rarity, image_url, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Species</h2>
        <Link
          href="/admin/species/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New species
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">Species</th>
              <th className="px-4 py-2">Rarity</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(species ?? []).map((s) => (
              <tr
                key={s.id}
                className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/species/${s.id}`} className="flex items-center gap-2 hover:underline">
                    {s.image_url ? (
                      <Image src={s.image_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                    ) : null}
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2 capitalize">{s.rarity}</td>
                <td className="px-4 py-2">{s.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(species ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                  No species yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
