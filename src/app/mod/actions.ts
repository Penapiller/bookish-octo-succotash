"use server";

import { revalidatePath } from "next/cache";
import { requireModerator } from "@/lib/moderation";
import type { ReportStatus } from "@/lib/supabase/types";

// Plain form actions (no useActionState, no redirect) — same "just does
// the thing, no confirmation step" convention as other staff-only writes
// in this app (deleteFolder, updateThreadFlags). requireModerator() here
// is defense in depth: the button is only rendered inside /mod (already
// gated by its own layout), and reports' staff-only UPDATE RLS policy
// (0027_moderation.sql) is the real backstop either way.

export async function resolveReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  if (reportId.length === 0 || (status !== "resolved" && status !== "dismissed")) return;

  const noteRaw = formData.get("resolution_note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";

  await supabase
    .from("reports")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: note.length > 0 ? note : null,
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
}

// Deletes the reported post AND resolves the report in one step — the
// same underlying delete as forums/actions.ts's deletePost, just entered
// from the queue's workflow instead of the thread view, so it also closes
// out the report rather than leaving it pointing at a post that no longer
// exists.
export async function deleteReportedPost(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (reportId.length === 0 || postId.length === 0) return;

  await supabase.from("forum_posts").delete().eq("id", postId);
  await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: "Post deleted.",
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
}
