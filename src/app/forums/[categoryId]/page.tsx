import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ForumThreadListItem } from "@/lib/supabase/types";

export default async function ForumCategoryPage(props: PageProps<"/forums/[categoryId]">) {
  const { categoryId } = await props.params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, parent_id, name, description, icon_url, is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category || !category.is_active) {
    notFound();
  }

  const [{ data: parent }, { data: children }, { data: threadsData }] = await Promise.all([
    category.parent_id
      ? supabase.from("forum_categories").select("id, name").eq("id", category.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    category.parent_id === null
      ? supabase
          .from("forum_categories")
          .select("id, name, icon_url")
          .eq("parent_id", category.id)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: null }),
    supabase
      .from("forum_threads")
      .select("id, title, is_pinned, is_locked, reply_count, created_at, last_post_at, author_id")
      .eq("category_id", category.id)
      .order("is_pinned", { ascending: false })
      .order("last_post_at", { ascending: false }),
  ]);

  const threadRows = threadsData ?? [];
  const authorIds = [...new Set(threadRows.map((t) => t.author_id))];
  const { data: profiles } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name").in("id", authorIds)
      : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const threads: ForumThreadListItem[] = threadRows.map((t) => ({
    id: t.id,
    title: t.title,
    is_pinned: t.is_pinned,
    is_locked: t.is_locked,
    reply_count: t.reply_count,
    created_at: t.created_at,
    last_post_at: t.last_post_at,
    authorId: t.author_id,
    authorName: nameById.get(t.author_id) ?? "Unknown",
  }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <div className="text-sm text-stone-500">
          <Link href="/forums" className="hover:underline">
            Forums
          </Link>
          {parent ? (
            <>
              {" / "}
              <Link href={`/forums/${parent.id}`} className="hover:underline">
                {parent.name}
              </Link>
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
          <Link
            href={`/forums/${category.id}/new`}
            className="rounded-md bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
          >
            + New thread
          </Link>
        </div>
        {category.description ? <p className="text-stone-500">{category.description}</p> : null}
      </div>

      {children && children.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">Subcategories</h2>
          <div className="overflow-hidden rounded-lg border border-amber-200 dark:border-stone-800">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/forums/${child.id}`}
                className="flex items-center gap-3 border-t border-amber-200 p-3 first:border-t-0 hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                {child.icon_url ? (
                  <Image src={child.icon_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                ) : null}
                {child.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-amber-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-amber-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Thread</th>
              <th className="px-4 py-2">Author</th>
              <th className="px-4 py-2">Replies</th>
              <th className="px-4 py-2">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {threads.map((thread) => (
              <tr
                key={thread.id}
                className="border-t border-amber-200 hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/forums/${category.id}/${thread.id}`} className="hover:underline">
                    {thread.is_pinned ? <span title="Pinned">📌 </span> : null}
                    {thread.is_locked ? <span title="Locked">🔒 </span> : null}
                    {thread.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-stone-500">{thread.authorName}</td>
                <td className="px-4 py-2 text-stone-500">{thread.reply_count}</td>
                <td className="px-4 py-2 text-stone-500">
                  {new Date(thread.last_post_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {threads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                  No threads yet — be the first to post!
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
