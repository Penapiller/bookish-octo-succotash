import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminGardenPlantsPage() {
  const { supabase } = await requireAdmin();

  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id, name, image_stage1_url, base_coin_yield, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Garden plants</h2>
        <Link
          href="/admin/garden-plants/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New plant
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Plant</th>
              <th className="px-4 py-2">Base coin yield</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(plants ?? []).map((p) => (
              <tr key={p.id} className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900">
                <td className="px-4 py-2">
                  <Link href={`/admin/garden-plants/${p.id}`} className="flex items-center gap-2 hover:underline">
                    {p.image_stage1_url ? (
                      <Image src={p.image_stage1_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                    ) : null}
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.base_coin_yield}</td>
                <td className="px-4 py-2">{p.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(plants ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No garden plants yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
