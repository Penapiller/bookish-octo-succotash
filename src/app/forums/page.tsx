import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ForumCategoryRow } from "@/lib/supabase/types";

type CategoryWithCount = ForumCategoryRow & { threadCount: number };

function groupByParent(
  categories: ForumCategoryRow[],
  threadCountByCategory: Map<string, number>,
): (CategoryWithCount & { children: CategoryWithCount[] })[] {
  const topLevel = categories.filter((c) => c.parent_id === null);
  return topLevel.map((parent) => ({
    ...parent,
    threadCount: threadCountByCategory.get(parent.id) ?? 0,
    children: categories
      .filter((c) => c.parent_id === parent.id)
      .map((child) => ({ ...child, threadCount: threadCountByCategory.get(child.id) ?? 0 })),
  }));
}

export default async function ForumsIndexPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: threadCategoryIds }] = await Promise.all([
    supabase
      .from("forum_categories")
      .select("id, parent_id, name, description, icon_url, sort_order, is_active, created_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("forum_threads").select("category_id"),
  ]);

  const threadCountByCategory = new Map<string, number>();
  for (const { category_id } of threadCategoryIds ?? []) {
    threadCountByCategory.set(category_id, (threadCountByCategory.get(category_id) ?? 0) + 1);
  }

  const tree = groupByParent(categories ?? [], threadCountByCategory);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Forums</h1>

      <div className="flex flex-col gap-4">
        {tree.map((category) => (
          <div
            key={category.id}
            className="overflow-hidden rounded-lg border border-amber-200 dark:border-stone-800"
          >
            <CategoryTile category={category} />
            {category.children.length > 0 ? (
              <div className="divide-y divide-amber-200 border-t border-amber-200 dark:divide-stone-800 dark:border-stone-800">
                {category.children.map((child) => (
                  <div key={child.id} className="pl-8">
                    <CategoryTile category={child} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {tree.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 p-6 text-center text-stone-500 dark:border-stone-700">
            No forum categories yet — check back soon.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function CategoryTile({ category }: { category: CategoryWithCount }) {
  return (
    <Link
      href={`/forums/${category.id}`}
      className="flex items-center gap-3 p-4 hover:bg-amber-50 dark:hover:bg-stone-900"
    >
      {category.icon_url ? (
        <Image src={category.icon_url} alt="" width={36} height={36} className="h-9 w-9 rounded" />
      ) : (
        <div className="h-9 w-9 rounded border border-dashed border-amber-300 dark:border-stone-700" />
      )}
      <div className="flex-1">
        <div className="font-medium">{category.name}</div>
        {category.description ? (
          <p className="text-sm text-stone-500">{category.description}</p>
        ) : null}
      </div>
      <span className="text-sm text-stone-500">
        {category.threadCount} thread{category.threadCount === 1 ? "" : "s"}
      </span>
    </Link>
  );
}
