import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MessageSquare, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";
import { ReplyToggle } from "./reply-toggle";
import { ThreadAdminControls } from "./thread-admin-controls";
import { DeletePostButton } from "./delete-post-button";
import { ForumPanel, ForumPanelSection } from "@/components/forums/forum-panel";
import { ReportButton } from "@/components/report-button";
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
      .select("id, author_id, body_raw, body_html, created_at, edited_at, edit_count, last_edited_by", {
        count: "exact",
      })
      .eq("thread_id", thread.id)
      .order("created_at")
      .range(offset, offset + PAGE_SIZE - 1),
    user
      ? supabase.from("users").select("is_admin, is_moderator").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    // Best-effort view counter — not awaited-for-correctness, just fired
    // alongside the rest of this page's data so it doesn't add a round
    // trip. See increment_thread_view_count() (0022_forum_bbcode_and_views.sql).
    supabase.rpc("increment_thread_view_count", { p_thread_id: thread.id }),
  ]);

  const isAdmin = profile?.data?.is_admin ?? false;
  const canModerate = isAdmin || (profile?.data?.is_moderator ?? false);

  const posts = postsData ?? [];
  // last_edited_by is usually the same person as author_id, but not
  // always — an admin can edit someone else's post — so it needs its
  // own name resolved too. Folded into the same lookup rather than a
  // second query.
  const profileIds = [
    ...new Set(posts.flatMap((p) => [p.author_id, p.last_edited_by].filter((id): id is string => id !== null))),
  ];
  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", profileIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const postsWithAuthor: ForumPostWithAuthor[] = posts.map((p) => ({
    id: p.id,
    body_raw: p.body_raw,
    body_html: p.body_html,
    created_at: p.created_at,
    edited_at: p.edited_at,
    edit_count: p.edit_count,
    authorId: p.author_id,
    authorName: profileById.get(p.author_id)?.display_name ?? "Unknown",
    authorAvatarUrl: profileById.get(p.author_id)?.avatar_url ?? null,
    lastEditorName: p.last_edited_by ? (profileById.get(p.last_edited_by)?.display_name ?? "Unknown") : null,
  }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-12">
      <ForumPanel
        icon={thread.is_locked ? <Lock size={18} /> : <MessageSquare size={18} />}
        title={category ? `${category.name} > ${thread.title}` : thread.title}
        action={
          canModerate ? (
            <ThreadAdminControls
              categoryId={categoryId}
              threadId={thread.id}
              isPinned={thread.is_pinned}
              isLocked={thread.is_locked}
            />
          ) : null
        }
      >
        <div>
          {postsWithAuthor.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryId={categoryId}
              threadId={thread.id}
              canEdit={user?.id === post.authorId || isAdmin}
              canModerate={canModerate}
              canReport={!!user && user.id !== post.authorId}
            />
          ))}
        </div>

        <PaginationBar basePath={`/forums/${categoryId}/${threadId}`} page={page} totalPages={totalPages} />
      </ForumPanel>

      {thread.is_locked ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-stone-500">
          This thread is locked — no new replies.
        </p>
      ) : user ? (
        <ReplyToggle>
          <ForumPanelWrapper title={`Reply to ${thread.title}`}>
            <div className="p-5">
              <ReplyForm categoryId={categoryId} threadId={thread.id} />
            </div>
          </ForumPanelWrapper>
        </ReplyToggle>
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-5 py-4 text-sm">
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
    <div className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">
      <ForumPanelSection title={title}>{children}</ForumPanelSection>
    </div>
  );
}

function PostCard({
  post,
  categoryId,
  threadId,
  canEdit,
  canModerate,
  canReport,
}: {
  post: ForumPostWithAuthor;
  categoryId: string;
  threadId: string;
  canEdit: boolean;
  canModerate: boolean;
  canReport: boolean;
}) {
  return (
    <article className="flex flex-col gap-4 border-t border-amber-100 p-6 first:border-t-0 sm:flex-row">
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-32 sm:flex-col sm:text-center">
        {post.authorAvatarUrl ? (
          <Image
            src={post.authorAvatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 rounded-md border-2 border-amber-400 object-cover sm:h-[72px] sm:w-[72px]"
          />
        ) : (
          <div className="h-16 w-16 rounded-md border-2 border-dashed border-amber-300 sm:h-[72px] sm:w-[72px]" />
        )}
        <Link href={`/u/${post.authorId}`} className="text-sm font-semibold hover:underline">
          {post.authorName}
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-stone-500">Posted {formatForumDate(post.created_at)}</div>
          <div className="flex shrink-0 gap-2">
            {canEdit ? (
              <Link
                href={`/forums/${categoryId}/${threadId}/${post.id}/edit`}
                className="flex items-center gap-1.5 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs font-medium hover:bg-amber-50"
              >
                <Pencil size={14} />
                Edit
              </Link>
            ) : null}
            {canModerate ? (
              <DeletePostButton categoryId={categoryId} threadId={threadId} postId={post.id} />
            ) : null}
            {canReport ? <ReportButton targetType="forum_post" targetId={post.id} /> : null}
          </div>
        </div>
        {/* body_html is produced exclusively by bbcodeToHtml() at write
            time (src/lib/bbcode.ts) — this is the one place that
            rendered output is ever trusted enough to render. Never
            render body_raw directly. */}
        <div
          className="forum-content text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.body_html }}
        />
        {post.edit_count > 0 && post.edited_at ? (
          <p className="text-xs text-stone-400">
            Last edited by {post.lastEditorName ?? "Unknown"} at {formatForumDate(post.edited_at)}. This post
            has been edited {post.edit_count} time{post.edit_count === 1 ? "" : "s"}.
          </p>
        ) : null}
      </div>
    </article>
  );
}
