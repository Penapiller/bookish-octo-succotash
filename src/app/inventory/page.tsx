import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: petsData }, { data: inventoryData }] = await Promise.all([
    supabase
      .from("pets")
      .select("id, rarity, color_variant, created_at, species(name, image_url)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_inventory")
      .select("quantity, item:items(id, name, image_url, rarity, type)")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("item_id", { ascending: true }),
  ]);

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];
  const items = (inventoryData ?? []) as unknown as ItemWithQuantity[];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-zinc-500">
          Pets are shown in blue, crafting ingredients in green, potions in purple.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Pets ({pets.length})</h2>
        {pets.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">You don&apos;t have any pets yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {pets.map((pet) => (
              <li
                key={pet.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800"
              >
                {pet.species?.image_url ? (
                  <Image
                    src={pet.species.image_url}
                    alt={pet.species?.name ?? ""}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded border-2 border-blue-600"
                  />
                ) : (
                  <div className="h-24 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                )}
                <p className="text-sm font-medium">{pet.species?.name}</p>
                <p className="text-xs capitalize text-zinc-500">{pet.rarity}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Items ({items.length})</h2>
        <p className="text-xs text-zinc-500">
          Crafting ingredients and brewed potions — not for decorating pets. Turn ingredients into
          potions on the <Link href="/brewing" className="underline">Brewing</Link> page.
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">
            No items yet — expeditions sometimes return one instead of a pet.
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
      </section>
    </main>
  );
}
