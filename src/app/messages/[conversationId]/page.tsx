import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatForumDate } from "@/lib/format-forum-date";
import { ForumPanel, ForumPanelSection } from "@/components/forums/forum-panel";
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

  const [{ data: myProfile }, { data: otherProfile }, { data: messagesData }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name, avatar_url").eq("id", user.id).single(),
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-12">
      <Link
        href="/messages"
        className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline"
      >
        <ArrowLeft size={14} />
        Back to messages
      </Link>

      <ForumPanel
        icon={<Mail size={18} />}
        title={`Conversation with ${otherName}`}
        action={
          <Link href={`/u/${otherUserId}`} className="text-sm text-white/90 underline hover:text-white">
            View profile
          </Link>
        }
      >
        <div>
          {messages.length === 0 ? (
            <p className="px-6 py-6 text-sm italic text-stone-500">
              No messages yet — say hello to {otherName}.
            </p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === user.id;
              const author = isMine ? myProfile : otherProfile;
              const authorName = isMine ? "You" : otherName;
              return (
                <MessageCard
                  key={message.id}
                  authorId={author?.id ?? message.sender_id}
                  authorName={authorName}
                  authorAvatarUrl={author?.avatar_url ?? null}
                  createdAt={message.created_at}
                  body={message.body}
                />
              );
            })
          )}
        </div>
      </ForumPanel>

      <div className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">
        <ForumPanelSection title={`Reply to ${otherName}`}>
          <div className="p-5">
            <ReplyForm conversationId={conversationId} />
          </div>
        </ForumPanelSection>
      </div>
    </main>
  );
}

// Same avatar-left / name-timestamp-body-right shape as forum posts'
// PostCard (src/app/forums/[categoryId]/[threadId]/page.tsx) — no
// edit/report buttons, since messages can't be edited or reported yet.
function MessageCard({
  authorId,
  authorName,
  authorAvatarUrl,
  createdAt,
  body,
}: {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
  body: string;
}) {
  return (
    <article className="flex flex-col gap-4 border-t border-amber-100 p-6 first:border-t-0 sm:flex-row">
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-32 sm:flex-col sm:text-center">
        {authorAvatarUrl ? (
          <Image
            src={authorAvatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 rounded-md border-2 border-amber-400 object-cover sm:h-[72px] sm:w-[72px]"
          />
        ) : (
          <div className="h-16 w-16 rounded-md border-2 border-dashed border-amber-300 sm:h-[72px] sm:w-[72px]" />
        )}
        <Link href={`/u/${authorId}`} className="text-sm font-semibold hover:underline">
          {authorName}
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="text-sm text-stone-500">Sent {formatForumDate(createdAt)}</div>
        {/* Plain text, not BBCode — a DM isn't a forum post, so this is
            never passed through bbcodeToHtml()/dangerouslySetInnerHTML. */}
        <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{body}</p>
      </div>
    </article>
  );
}
