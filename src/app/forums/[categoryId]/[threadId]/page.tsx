import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";
import { ThreadAdminControls } from "./thread-admin-controls";
import type { ForumPostWithAuthor } from "@/lib/supabase/types";

export default async function ForumThreadPage(props: PageProps<"/forums/[categoryId]/[threadId]">) {
  const { categoryId, threadId } = await props.params;
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, category_id, title, is_pinned, is_locked, created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.category_id !== categoryId) {
    notFound();
  }

  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, name")
    .eq("id", categoryId)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: postsData }, profile] = await Promise.all([
    supabase
      .from("forum_posts")
      .select("id, author_id, editor_mode, body_raw, body_html, created_at, edited_at")
      .eq("thread_id", thread.id)
      .order("created_at"),
    user
      ? supabase.from("users").select("is_admin").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
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
    editor_mode: p.editor_mode,
    body_raw: p.body_raw,
    body_html: p.body_html,
    created_at: p.created_at,
    edited_at: p.edited_at,
    authorId: p.author_id,
    authorName: profileById.get(p.author_id)?.display_name ?? "Unknown",
    authorAvatarUrl: profileById.get(p.author_id)?.avatar_url ?? null,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <div className="text-sm text-stone-500">
          <Link href="/forums" className="hover:underline">
            Forums
          </Link>
          {category ? (
            <>
              {" / "}
              <Link href={`/forums/${category.id}`} className="hover:underline">
                {category.name}
              </Link>
            </>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {thread.is_pinned ? <span title="Pinned">📌 </span> : null}
          {thread.is_locked ? <span title="Locked">🔒 </span> : null}
          {thread.title}
        </h1>
      </div>

      {isAdmin ? (
        <ThreadAdminControls
          categoryId={categoryId}
          threadId={thread.id}
          isPinned={thread.is_pinned}
          isLocked={thread.is_locked}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {postsWithAuthor.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {thread.is_locked ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-900">
          This thread is locked — no new replies.
        </p>
      ) : user ? (
        <ReplyForm categoryId={categoryId} threadId={thread.id} />
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-900">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to reply.
        </p>
      )}
    </main>
  );
}

function PostCard({ post }: { post: ForumPostWithAuthor }) {
  return (
    <article className="flex gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
      <div className="flex w-28 shrink-0 flex-col items-center gap-1 text-center">
        {post.authorAvatarUrl ? (
          <Image
            src={post.authorAvatarUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-full border border-amber-300 object-cover dark:border-stone-700"
          />
        ) : (
          <div className="h-14 w-14 rounded-full border border-dashed border-amber-300 dark:border-stone-700" />
        )}
        <Link href={`/u/${post.authorId}`} className="text-sm font-medium hover:underline">
          {post.authorName}
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="text-xs text-stone-500">
          {new Date(post.created_at).toLocaleString()}
          {post.edited_at ? " (edited)" : ""}
        </div>
        {/* body_html is produced exclusively by sanitizeForumHtml() at write
            time (src/lib/sanitize-forum-html.ts) — this is the one place
            that sanitized output is ever trusted enough to render. Never
            render body_raw directly. */}
        <div className="forum-content text-sm" dangerouslySetInnerHTML={{ __html: post.body_html }} />
      </div>
    </article>
  );
}
