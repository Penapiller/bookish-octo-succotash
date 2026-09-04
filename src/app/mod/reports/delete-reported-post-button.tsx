"use client";

import { Trash2 } from "lucide-react";
import { deleteReportedPost } from "../actions";

export function DeleteReportedPostButton({ reportId, postId }: { reportId: string; postId: string }) {
  return (
    <form
      action={deleteReportedPost}
      onSubmit={(event) => {
        if (!confirm("Delete this post and mark the report resolved? This can't be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="post_id" value={postId} />
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 size={14} />
        Delete post
      </button>
    </form>
  );
}
