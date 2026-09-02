import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ItemType, ItemWithQuantity } from "@/lib/supabase/types";

const TABS: { value: ItemType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ingredient", label: "Ingredients" },
  { value: "potion", label: "Potions" },
  { value: "cosmetic", label: "Cosmetics" },
];

function isItemType(value: string): value is ItemType {
  return value === "ingredient" || value === "potion" || value === "cosmetic";
}

export default async function ItemsPage(props: PageProps<"/items">) {
  const searchParams = await props.searchParams;
  const typeParam = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type;
  const activeTab = typeParam && isItemType(typeParam) ? typeParam : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: inventoryData } = await supabase
    .from("user_inventory")
    .select("quantity, item:items(id, name, image_url, rarity, type)")
    .eq("user_id", user.id)
    .gt("quantity", 0)
    .order("item_id", { ascending: true });

  const allItems = (inventoryData ?? []) as unknown as ItemWithQuantity[];
  const items =
    activeTab === "all" ? allItems : allItems.filter((entry) => entry.item?.type === activeTab);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Items ({allItems.length})</h1>
        <p className="text-sm text-zinc-500">
          Crafting ingredients and brewed potions — not for decorating pets. Turn ingredients into
          potions on the{" "}
          <Link href="/brewing" className="underline">
            Brewing
          </Link>{" "}
          page.{" "}
          <Link href="/pets" className="underline">
            Looking for pets?
          </Link>
        </p>
      </div>

      <nav className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/items" : `/items?type=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === tab.value
                ? "border-zinc-900 font-medium dark:border-white"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">
          {allItems.length === 0
            ? "No items yet — expeditions sometimes return one instead of a pet."
            : "Nothing in this category yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((entry) =>
            entry.item ? (
              <li
                key={entry.item.id}
                className="relative flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800"
              >
                <span className="absolute right-2 top-2 rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
                  ×{entry.quantity}
                </span>
                {entry.item.image_url ? (
                  <Image
                    src={entry.item.image_url}
                    alt={entry.item.name}
                    width={96}
                    height={96}
                    className={`h-24 w-24 rounded border-2 ${
                      entry.item.type === "potion" ? "border-purple-600" : "border-green-600"
                    }`}
                  />
                ) : (
                  <div className="h-24 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                )}
                <p className="text-sm font-medium">{entry.item.name}</p>
                <p className="text-xs capitalize text-zinc-500">
                  {entry.item.type} · {entry.item.rarity}
                </p>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </main>
  );
}
