import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminItemsPage() {
  const { supabase } = await requireAdmin();

  const { data: items } = await supabase
    .from("items")
    .select("id, name, type, rarity, image_url, sell_value, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Items</h2>
        <Link
          href="/admin/items/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New item
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Rarity</th>
              <th className="px-4 py-2">Sell value</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr
                key={item.id}
                className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/items/${item.id}`} className="flex items-center gap-2 hover:underline">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded"
                      />
                    ) : null}
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{item.type}</td>
                <td className="px-4 py-2 capitalize">{item.rarity}</td>
                <td className="px-4 py-2">{item.sell_value}</td>
                <td className="px-4 py-2">{item.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(items ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
