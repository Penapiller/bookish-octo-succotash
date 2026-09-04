import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/format-forum-date";
import { isConversationUnread } from "@/lib/dm-unread";
import { NewMessageForm } from "./new-message-form";
import type { DmConversationRow, DmConversationSummary } from "@/lib/supabase/types";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: conversationsData } = await supabase
    .from("dm_conversations")
    .select("*")
    .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  const conversations = (conversationsData ?? []) as DmConversationRow[];

  const otherUserIds = [
    ...new Set(
      conversations.map((c) => (c.user_one_id === user.id ? c.user_two_id : c.user_one_id)),
    ),
  ];

  const { data: profilesData } =
    otherUserIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", otherUserIds)
      : { data: [] };

  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));

  const summaries: DmConversationSummary[] = conversations.map((c) => {
    const otherUserId = c.user_one_id === user.id ? c.user_two_id : c.user_one_id;
    const otherProfile = profileById.get(otherUserId);

    return {
      id: c.id,
      last_message_at: c.last_message_at,
      last_message_body: c.last_message_body,
      otherUserId,
      otherUserName: otherProfile?.display_name ?? "Unknown player",
      otherUserAvatarUrl: otherProfile?.avatar_url ?? null,
      lastMessageIsMine: c.last_message_sender_id === user.id,
      isUnread: isConversationUnread(c, user.id),
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-stone-500">Private conversations with other players.</p>
      </div>

      <NewMessageForm />

      {summaries.length === 0 ? (
        <p className="text-sm text-stone-500 italic">
          No conversations yet. Start one from a player&apos;s profile, or above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {summaries.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-lg border border-amber-200 p-3 hover:bg-amber-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                {c.otherUserAvatarUrl ? (
                  <Image
                    src={c.otherUserAvatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-md bg-amber-200 dark:bg-stone-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${c.isUnread ? "font-semibold" : "font-medium"}`}>
                      {c.otherUserName}
                    </span>
                    {c.isUnread ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-600 dark:bg-amber-300" />
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-stone-500">
                    {c.lastMessageIsMine ? "You: " : ""}
                    {c.last_message_body ?? "No messages yet."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-xs text-stone-400">
                  <Mail size={12} />
                  {formatShortDate(c.last_message_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
