import Link from "next/link";
import { requireModerator } from "@/lib/moderation";
import { ResolveReportForm } from "./resolve-report-form";
import { DeleteReportedPostButton } from "./delete-reported-post-button";
import type { ReportRow, ReportStatus, ReportWithDetails } from "@/lib/supabase/types";

const TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ModReportsPage(props: PageProps<"/mod/reports">) {
  const { supabase } = await requireModerator();
  const searchParams = await props.searchParams;
  const statusParam = first(searchParams.status);
  const activeStatus: ReportStatus = TABS.some((t) => t.value === statusParam)
    ? (statusParam as ReportStatus)
    : "open";

  const { data: reportsData } = await supabase
    .from("reports")
    .select("*")
    .eq("status", activeStatus)
    .order("created_at", { ascending: activeStatus === "open" });

  const reports = (reportsData ?? []) as ReportRow[];

  const userIds = [
    ...new Set(
      reports.flatMap((r) => [r.reporter_id, r.target_user_id, r.resolved_by].filter((id): id is string => id !== null)),
    ),
  ];
  const postIds = [...new Set(reports.map((r) => r.target_post_id).filter((id): id is string => id !== null))];

  const [{ data: profilesData }, { data: postsData }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("user_profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? supabase.from("forum_posts").select("id, thread_id, author_id, body_raw").in("id", postIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));
  const postById = new Map((postsData ?? []).map((p) => [p.id, p]));

  const threadIds = [...new Set((postsData ?? []).map((p) => p.thread_id))];
  const { data: threadsData } =
    threadIds.length > 0
      ? await supabase.from("forum_threads").select("id, category_id, title").in("id", threadIds)
      : { data: [] };
  const threadById = new Map((threadsData ?? []).map((t) => [t.id, t]));

  const reportsWithDetails: ReportWithDetails[] = reports.map((r) => {
    const post = r.target_post_id ? postById.get(r.target_post_id) : null;
    const thread = post ? threadById.get(post.thread_id) : null;

    return {
      id: r.id,
      target_type: r.target_type,
      category: r.category,
      details: r.details,
      status: r.status,
      resolved_at: r.resolved_at,
      resolution_note: r.resolution_note,
      created_at: r.created_at,
      reporterId: r.reporter_id,
      reporterName: profileById.get(r.reporter_id)?.display_name ?? "Unknown",
      targetUserId: r.target_user_id,
      targetUserName: r.target_user_id ? (profileById.get(r.target_user_id)?.display_name ?? "Unknown") : null,
      targetPostId: r.target_post_id,
      targetPostBody: post?.body_raw ?? null,
      targetPostAuthorName: post ? (profileById.get(post.author_id)?.display_name ?? "Unknown") : null,
      targetThreadId: post?.thread_id ?? null,
      targetCategoryId: thread?.category_id ?? null,
      resolvedByName: r.resolved_by ? (profileById.get(r.resolved_by)?.display_name ?? "Unknown") : null,
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-2 border-b border-amber-200 dark:border-stone-800">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/reports?status=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeStatus === tab.value
                ? "border-amber-800 font-medium dark:border-amber-200"
                : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {reportsWithDetails.length === 0 ? (
        <p className="text-sm italic text-stone-500">No {activeStatus} reports.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reportsWithDetails.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  scam: "Scamming",
  other: "Other",
};

function ReportCard({ report }: { report: ReportWithDetails }) {
  const createdAt = new Date(report.created_at).toLocaleString();

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm">
            <Link href={`/u/${report.reporterId}`} className="font-medium hover:underline">
              {report.reporterName}
            </Link>{" "}
            reported {report.target_type === "user" ? "a player" : "a forum post"} —{" "}
            <span className="font-medium">{CATEGORY_LABELS[report.category] ?? report.category}</span>
          </p>
          <p className="text-xs text-stone-500">{createdAt}</p>
        </div>
      </div>

      {report.target_type === "user" && report.targetUserId ? (
        <p className="text-sm">
          Target:{" "}
          <Link href={`/u/${report.targetUserId}`} className="font-medium hover:underline">
            {report.targetUserName}
          </Link>
        </p>
      ) : report.targetPostId ? (
        <div className="rounded-md border border-amber-100 bg-amber-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
          <p className="text-xs text-stone-500">
            Post by <span className="font-medium">{report.targetPostAuthorName}</span>
            {report.targetCategoryId && report.targetThreadId ? (
              <>
                {" "}
                —{" "}
                <Link
                  href={`/forums/${report.targetCategoryId}/${report.targetThreadId}`}
                  className="underline"
                >
                  View thread
                </Link>
              </>
            ) : (
              " (deleted)"
            )}
          </p>
          {report.targetPostBody ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{report.targetPostBody}</p> : null}
        </div>
      ) : null}

      {report.details ? <p className="text-sm text-stone-600 dark:text-stone-400">&ldquo;{report.details}&rdquo;</p> : null}

      {report.status === "open" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-100 pt-3 dark:border-stone-800">
          <ResolveReportForm reportId={report.id} status="resolved" label="Mark resolved" />
          <ResolveReportForm reportId={report.id} status="dismissed" label="Dismiss" />
          {report.target_type === "forum_post" && report.targetPostId ? (
            <DeleteReportedPostButton reportId={report.id} postId={report.targetPostId} />
          ) : null}
        </div>
      ) : (
        <p className="border-t border-amber-100 pt-3 text-xs text-stone-500 dark:border-stone-800">
          {report.status === "resolved" ? "Resolved" : "Dismissed"} by{" "}
          <span className="font-medium">{report.resolvedByName}</span>
          {report.resolved_at ? ` at ${new Date(report.resolved_at).toLocaleString()}` : ""}
          {report.resolution_note ? ` — ${report.resolution_note}` : ""}
        </p>
      )}
    </li>
  );
}
