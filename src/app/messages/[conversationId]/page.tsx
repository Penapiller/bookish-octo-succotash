import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatForumDate } from "@/lib/format-forum-date";
import { ReplyForm } from "./reply-form";
import type { DmConversationRow, DmMessageRow } from "@/lib/supabase/types";

const MESSAGE_LIMIT = 200;

export default async function ConversationPage(
  props: PageProps<"/messages/[conversationId]">,
) {
  const { conversationId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: conversationData } = await supabase
    .from("dm_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  const conversation = conversationData as DmConversationRow | null;

  // RLS already scopes the select above to conversations the caller is a
  // participant in — a nonexistent id and someone else's conversation
  // both land here as "not found", which is exactly the response either
  // case should get.
  if (!conversation) {
    notFound();
  }

  const otherUserId =
    conversation.user_one_id === user.id ? conversation.user_two_id : conversation.user_one_id;

  const [{ data: otherProfile }, { data: messagesData }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name, avatar_url").eq("id", otherUserId).single(),
    supabase
      .from("dm_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT),
  ]);

  // Marks the conversation read as of now for the signed-in participant —
  // same "do it as a side effect of loading the page" pattern as
  // increment_thread_view_count on the forum thread page.
  await supabase.rpc("mark_dm_conversation_read", {
    p_user_id: user.id,
    p_conversation_id: conversationId,
  });

  const messages = ((messagesData ?? []) as DmMessageRow[]).slice().reverse();
  const otherName = otherProfile?.display_name ?? "Unknown player";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <div className="flex items-center gap-3">
        <Link
          href="/messages"
          className="rounded-md p-1.5 text-stone-500 hover:bg-amber-100 dark:hover:bg-stone-900"
          aria-label="Back to messages"
        >
          <ArrowLeft size={18} />
        </Link>
        {otherProfile?.avatar_url ? (
          <Image
            src={otherProfile.avatar_url}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-md object-cover"
          />
        ) : (
          <div className="h-9 w-9 rounded-md bg-amber-200 dark:bg-stone-800" />
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{otherName}</h1>
          <Link href={`/u/${otherUserId}`} className="text-xs text-stone-500 underline">
            View profile
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
        {messages.length === 0 ? (
          <p className="text-sm text-stone-500 italic">
            No messages yet — say hello to {otherName}.
          </p>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === user.id;
            return (
              <div key={message.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                    isMine
                      ? "bg-amber-800 text-white dark:bg-amber-200 dark:text-amber-950"
                      : "bg-amber-50 text-stone-800 dark:bg-stone-800 dark:text-stone-100"
                  }`}
                >
                  {message.body}
                </div>
                <span className="mt-0.5 text-xs text-stone-400">
                  {isMine ? "You" : otherName} · {formatForumDate(message.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <ReplyForm conversationId={conversationId} />
    </main>
  );
}
