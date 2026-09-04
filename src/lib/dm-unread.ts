import type { DmConversationRow } from "@/lib/supabase/types";

// A conversation is unread for a given participant when the last message
// in it (a) exists, (b) wasn't sent by them, and (c) landed after their
// own read marker — see 0026_direct_messages.sql for why sending a
// message also bumps the sender's own marker (so this never needs a
// separate "does this concern me" check). Shared by the /messages inbox
// list and the header's unread-count badge so the two never drift.
export function isConversationUnread(
  conversation: Pick<
    DmConversationRow,
    "user_one_id" | "last_message_at" | "last_message_sender_id" | "user_one_last_read_at" | "user_two_last_read_at"
  >,
  userId: string,
): boolean {
  if (!conversation.last_message_sender_id || conversation.last_message_sender_id === userId) {
    return false;
  }

  const myLastReadAt =
    conversation.user_one_id === userId
      ? conversation.user_one_last_read_at
      : conversation.user_two_last_read_at;

  return myLastReadAt === null || new Date(conversation.last_message_at) > new Date(myLastReadAt);
}
