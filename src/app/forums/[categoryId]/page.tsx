import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForumPanel } from "@/components/forums/forum-panel";
import { PaginationBar } from "@/components/forums/pagination-bar";
import { formatForumDate } from "@/lib/format-forum-date";
import type { ForumThreadListItem } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForumCategoryPage(props: PageProps<"/forums/[categoryId]">) {
  const { categoryId } = await props.params;
  const searchParams = await props.searchParams;
  const pageParam = Number(first(searchParams.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, parent_id, name, description, icon_url, is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category || !category.is_active) {
    notFound();
  }

  const [{ data: parent }, { data: children }, { data: pinnedData }, { data: threadsData, count }] =
    await Promise.all([
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
        .select("id, title, is_pinned, is_locked, reply_count, view_count, created_at, last_post_at, author_id")
        .eq("category_id", category.id)
        .eq("is_pinned", true)
        .order("last_post_at", { ascending: false }),
      supabase
        .from("forum_threads")
        .select(
          "id, title, is_pinned, is_locked, reply_count, view_count, created_at, last_post_at, author_id",
          { count: "exact" },
        )
        .eq("category_id", category.id)
        .eq("is_pinned", false)
        .order("last_post_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ]);

  const pinnedRows = pinnedData ?? [];
  const threadRows = threadsData ?? [];
  const authorIds = [...new Set([...pinnedRows, ...threadRows].map((t) => t.author_id))];
  const { data: profiles } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name").in("id", authorIds)
      : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  function toListItem(t: (typeof threadRows)[number]): ForumThreadListItem {
    return {
      id: t.id,
      title: t.title,
      is_pinned: t.is_pinned,
      is_locked: t.is_locked,
      reply_count: t.reply_count,
      view_count: t.view_count,
      created_at: t.created_at,
      last_post_at: t.last_post_at,
      authorId: t.author_id,
      authorName: nameById.get(t.author_id) ?? "Unknown",
    };
  }

  const pinned = pinnedRows.map(toListItem);
  const threads = threadRows.map(toListItem);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const newPostButton = (
    <Link
      href={`/forums/${category.id}/new`}
      className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
    >
      New Post
    </Link>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-12">
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
        {" / "}
        {category.name}
      </div>

      {children && children.length > 0 ? (
        <ForumPanel icon={<span aria-hidden>📁</span>} title="Subcategories">
          <div>
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/forums/${child.id}`}
                className="flex items-center gap-3 border-t border-amber-100 p-3 first:border-t-0 hover:bg-amber-50"
              >
                {child.icon_url ? (
                  <Image src={child.icon_url} alt="" width={20} height={20} className="h-5 w-5 rounded" />
                ) : null}
                {child.name}
              </Link>
            ))}
          </div>
        </ForumPanel>
      ) : null}

      <ForumPanel icon={<span aria-hidden>🖼️</span>} title={`${category.name} — Pinned Topics`} action={newPostButton}>
        {pinned.length > 0 ? (
          <ThreadTable categoryId={category.id} threads={pinned} />
        ) : (
          <p className="p-4 text-sm text-stone-500">No pinned topics.</p>
        )}
      </ForumPanel>

      <ForumPanel icon={<span aria-hidden>🖼️</span>} title={category.name}>
        {threads.length > 0 ? (
          <ThreadTable categoryId={category.id} threads={threads} />
        ) : (
          <p className="p-6 text-center text-stone-500">No threads yet — be the first to post!</p>
        )}
        <PaginationBar basePath={`/forums/${category.id}`} page={page} totalPages={totalPages} />
      </ForumPanel>
    </main>
  );
}

function ThreadTable({ categoryId, threads }: { categoryId: string; threads: ForumThreadListItem[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {threads.map((thread) => (
          <tr key={thread.id} className="border-t border-amber-100 first:border-t-0 hover:bg-amber-50">
            <td className="w-8 px-4 py-3 text-lg" aria-hidden>
              {thread.is_locked ? "🔒" : "💬"}
            </td>
            <td className="px-2 py-3">
              <Link href={`/forums/${categoryId}/${thread.id}`} className="font-semibold hover:underline">
                {thread.title}
              </Link>
              <div className="text-xs text-stone-500">
                Posted by <span className="font-medium">{thread.authorName}</span> »{" "}
                {formatForumDate(thread.created_at)}
              </div>
            </td>
            <td className="w-20 px-4 py-3 text-right text-xs text-stone-500">
              <div className="font-semibold text-stone-700">{thread.view_count}</div>
              Views
            </td>
            <td className="w-20 px-4 py-3 text-right text-xs text-stone-500">
              <div className="font-semibold text-stone-700">{thread.reply_count}</div>
              Replies
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
