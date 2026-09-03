"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bbcodeToHtml } from "@/lib/bbcode";

export type ForumFormState = { error: string } | null;

// Shared by new-thread and reply forms — the raw body coming out of
// BBCodeEditor's textarea is untrusted whether a toolbar button or
// hand-typed tags produced it. bbcodeToHtml() is the only thing that
// turns it into something safe to store as body_html and later render
// with dangerouslySetInnerHTML.
function readAndRenderBody(formData: FormData): { ok: true; raw: string; html: string } | { ok: false; error: string } {
  const raw = String(formData.get("body") ?? "");
  if (raw.trim().length === 0) {
    return { ok: false, error: "Post can't be empty." };
  }
  if (raw.length > 20000) {
    return { ok: false, error: "Post is too long (20,000 character limit)." };
  }

  const html = bbcodeToHtml(raw);
  if (html.trim().length === 0) {
    return { ok: false, error: "That post didn't contain any content once cleaned up — try adding some text." };
  }

  return { ok: true, raw, html };
}

export async function createForumThread(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (categoryId.length === 0) return { error: "Missing category." };
  if (title.length === 0) return { error: "Title can't be empty." };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };

  const body = readAndRenderBody(formData);
  if (!body.ok) return { error: body.error };

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .insert({ category_id: categoryId, author_id: user.id, title })
    .select("id")
    .single();
  if (threadError || !thread) {
    return { error: `Could not start thread: ${threadError?.message ?? "unknown error"}` };
  }

  const { error: postError } = await supabase.from("forum_posts").insert({
    thread_id: thread.id,
    author_id: user.id,
    body_raw: body.raw,
    body_html: body.html,
  });
  if (postError) {
    return { error: `Thread created, but the first post failed to save: ${postError.message}` };
  }

  revalidatePath(`/forums/${categoryId}`);
  redirect(`/forums/${categoryId}/${thread.id}`);
}

export async function createForumReply(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0) return { error: "Missing thread." };

  const body = readAndRenderBody(formData);
  if (!body.ok) return { error: body.error };

  const { error } = await supabase.from("forum_posts").insert({
    thread_id: threadId,
    author_id: user.id,
    body_raw: body.raw,
    body_html: body.html,
  });
  if (error) {
    return { error: `Could not post your reply: ${error.message}` };
  }

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}

export async function updateForumPost(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0 || postId.length === 0) {
    return { error: "Missing post." };
  }

  const body = readAndRenderBody(formData);
  if (!body.ok) return { error: body.error };

  // No .select() row back means RLS silently filtered the update out —
  // "Authors and admins can edit a post" (0021_forums.sql) is the real
  // gate here; this just turns that into a readable message instead of
  // a redirect that looks like it worked.
  const { data, error } = await supabase
    .from("forum_posts")
    .update({ body_raw: body.raw, body_html: body.html, edited_at: new Date().toISOString() })
    .eq("id", postId)
    .select("id");
  if (error) {
    return { error: `Could not save your edit: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { error: "You can only edit your own posts." };
  }

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}

// Pin/lock are admin-only actions. The button that submits this form is
// only rendered for admins (see ThreadAdminControls), but that's just
// UI convenience — the real enforcement is forum_threads' admin-only
// UPDATE RLS policy (0021_forums.sql), which rejects this write outright
// for anyone else regardless of what the client sends.
export async function updateThreadFlags(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0) return;

  await supabase
    .from("forum_threads")
    .update({
      is_pinned: formData.get("is_pinned") === "on",
      is_locked: formData.get("is_locked") === "on",
    })
    .eq("id", threadId);

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}
