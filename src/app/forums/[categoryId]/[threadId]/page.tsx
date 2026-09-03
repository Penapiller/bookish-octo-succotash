import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";
import { ThreadAdminControls } from "./thread-admin-controls";
import { ForumPanel, ForumPanelSection } from "@/components/forums/forum-panel";
import { PaginationBar } from "@/components/forums/pagination-bar";
import { formatForumDate } from "@/lib/format-forum-date";
import type { ForumPostWithAuthor } from "@/lib/supabase/types";

const PAGE_SIZE = 10;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForumThreadPage(props: PageProps<"/forums/[categoryId]/[threadId]">) {
  const { categoryId, threadId } = await props.params;
  const searchParams = await props.searchParams;
  const pageParam = Number(first(searchParams.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, category_id, title, is_pinned, is_locked, created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.category_id !== categoryId) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: category }, { data: postsData, count }, profile] = await Promise.all([
    supabase.from("forum_categories").select("id, name").eq("id", categoryId).maybeSingle(),
    supabase
      .from("forum_posts")
      .select("id, author_id, body_raw, body_html, created_at, edited_at", { count: "exact" })
      .eq("thread_id", thread.id)
      .order("created_at")
      .range(offset, offset + PAGE_SIZE - 1),
    user ? supabase.from("users").select("is_admin").eq("id", user.id).single() : Promise.resolve({ data: null }),
    // Best-effort view counter — not awaited-for-correctness, just fired
    // alongside the rest of this page's data so it doesn't add a round
    // trip. See increment_thread_view_count() (0022_forum_bbcode_and_views.sql).
    supabase.rpc("increment_thread_view_count", { p_thread_id: thread.id }),
  ]);

  const isAdmin = profile?.data?.is_admin ?? false;

  const posts = postsData ?? [];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const { data: profiles } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", authorIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const postsWithAuthor: ForumPostWithAuthor[] = posts.map((p) => ({
    id: p.id,
    body_raw: p.body_raw,
    body_html: p.body_html,
    created_at: p.created_at,
    edited_at: p.edited_at,
    authorId: p.author_id,
    authorName: profileById.get(p.author_id)?.display_name ?? "Unknown",
    authorAvatarUrl: profileById.get(p.author_id)?.avatar_url ?? null,
  }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <ForumPanel
        icon={
          <span aria-hidden>
            {thread.is_locked ? "🔒" : "💬"}
          </span>
        }
        title={
          category ? `${category.name} > ${thread.title}` : thread.title
        }
      >
        {isAdmin ? (
          <ThreadAdminControls
            categoryId={categoryId}
            threadId={thread.id}
            isPinned={thread.is_pinned}
            isLocked={thread.is_locked}
          />
        ) : null}

        <div>
          {postsWithAuthor.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryId={categoryId}
              threadId={thread.id}
              canEdit={user?.id === post.authorId || isAdmin}
            />
          ))}
        </div>

        <PaginationBar basePath={`/forums/${categoryId}/${threadId}`} page={page} totalPages={totalPages} />
      </ForumPanel>

      {thread.is_locked ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-stone-500">
          This thread is locked — no new replies.
        </p>
      ) : user ? (
        <ForumPanelWrapper title={`Reply to ${thread.title}`}>
          <div className="p-4">
            <ReplyForm categoryId={categoryId} threadId={thread.id} />
          </div>
        </ForumPanelWrapper>
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to reply.
        </p>
      )}
    </main>
  );
}

function ForumPanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-300">
      <ForumPanelSection title={title}>{children}</ForumPanelSection>
    </div>
  );
}

function PostCard({
  post,
  categoryId,
  threadId,
  canEdit,
}: {
  post: ForumPostWithAuthor;
  categoryId: string;
  threadId: string;
  canEdit: boolean;
}) {
  return (
    <article className="flex gap-3 border-t border-amber-100 p-4 first:border-t-0">
      <div className="flex w-28 shrink-0 flex-col items-center gap-1 text-center">
        {post.authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar_url is arbitrary player-supplied storage data, not worth the build-time optimization config for a 56px thumbnail
          <img
            src={post.authorAvatarUrl}
            alt=""
            className="h-14 w-14 rounded-md border-2 border-amber-400 object-cover"
          />
        ) : (
          <div className="h-14 w-14 rounded-md border-2 border-dashed border-amber-300" />
        )}
        <Link href={`/u/${post.authorId}`} className="text-sm font-medium hover:underline">
          {post.authorName}
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-stone-500">
            Posted {formatForumDate(post.created_at)}
            {post.edited_at ? " (edited)" : ""}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {canEdit ? (
              <Link
                href={`/forums/${categoryId}/${threadId}/${post.id}/edit`}
                className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium hover:bg-amber-50"
              >
                ✏️ Edit
              </Link>
            ) : null}
            <button
              type="button"
              disabled
              title="Reporting isn't available yet"
              className="cursor-not-allowed rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-300"
            >
              🚩 Report
            </button>
          </div>
        </div>
        {/* body_html is produced exclusively by bbcodeToHtml() at write
            time (src/lib/bbcode.ts) — this is the one place that
            rendered output is ever trusted enough to render. Never
            render body_raw directly. */}
        <div className="forum-content text-sm" dangerouslySetInnerHTML={{ __html: post.body_html }} />
      </div>
    </article>
  );
}
