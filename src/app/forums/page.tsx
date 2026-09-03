import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ForumPanel } from "@/components/forums/forum-panel";
import type { ForumCategoryRow } from "@/lib/supabase/types";

type CategoryWithChildren = ForumCategoryRow & { children: ForumCategoryRow[] };

function groupByParent(categories: ForumCategoryRow[]): CategoryWithChildren[] {
  const topLevel = categories.filter((c) => c.parent_id === null);
  return topLevel.map((parent) => ({
    ...parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  }));
}

export default async function ForumsIndexPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("id, parent_id, name, description, icon_url, sort_order, is_active, created_at")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  const tree = groupByParent(categories ?? []);
  // Every active category (top-level and subcategories alike) gets a
  // jump link — flattened, since "which forum" matters more here than
  // the hierarchy the main panel shows.
  const flatForJump = categories ?? [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12 sm:flex-row sm:items-start">
      <aside className="w-full shrink-0 sm:w-56">
        <ForumPanel icon={<span aria-hidden>📌</span> } title="Quick Jump">
          <nav className="flex flex-col gap-1.5 p-2">
            {flatForJump.map((category) => (
              <Link
                key={category.id}
                href={`/forums/${category.id}`}
                className="flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
              >
                {category.icon_url ? (
                  <Image
                    src={category.icon_url}
                    alt=""
                    width={16}
                    height={16}
                    className="h-4 w-4 rounded-sm"
                  />
                ) : null}
                {category.name}
              </Link>
            ))}
            {flatForJump.length === 0 ? (
              <p className="px-2 py-1 text-sm text-stone-500">No categories yet.</p>
            ) : null}
          </nav>
        </ForumPanel>
      </aside>

      <div className="min-w-0 flex-1">
        <ForumPanel icon={<span aria-hidden>🗂️</span>} title="Forum Index">
          <div>
            {tree.map((category) => (
              <div key={category.id}>
                <CategoryRow category={category} />
                {category.children.map((child) => (
                  <CategoryRow key={child.id} category={child} indent />
                ))}
              </div>
            ))}
            {tree.length === 0 ? (
              <p className="p-6 text-center text-stone-500">No forum categories yet — check back soon.</p>
            ) : null}
          </div>
        </ForumPanel>
      </div>
    </main>
  );
}

function CategoryRow({ category, indent }: { category: ForumCategoryRow; indent?: boolean }) {
  return (
    <Link
      href={`/forums/${category.id}`}
      className={`flex items-start gap-3 border-t border-amber-100 p-4 first:border-t-0 hover:bg-amber-50 ${indent ? "pl-10" : ""}`}
    >
      {category.icon_url ? (
        <Image src={category.icon_url} alt="" width={28} height={28} className="mt-0.5 h-7 w-7 rounded" />
      ) : (
        <span className="mt-0.5 text-lg" aria-hidden>
          💬
        </span>
      )}
      <div className="flex-1">
        <div className="font-semibold text-amber-900">{category.name}</div>
        {category.description ? <p className="text-sm text-stone-500">{category.description}</p> : null}
      </div>
    </Link>
  );
}
