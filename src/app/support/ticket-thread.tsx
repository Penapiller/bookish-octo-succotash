import type { SupportTicketMessageWithSender } from "@/lib/supabase/types";

// revealStaffNames is false on the player-facing page — a staff reply
// shows as "Support Team" there, same "staff are invisible" treatment as
// warning DMs, even though the real sender_id is kept for staff-side
// accountability. The staff-facing /mod/support/[ticketId] view passes
// true, since staff coordinating a ticket need to see which of them
// already replied.
export function TicketThread({
  messages,
  viewerId,
  revealStaffNames,
}: {
  messages: SupportTicketMessageWithSender[];
  viewerId: string;
  revealStaffNames: boolean;
}) {
  if (messages.length === 0) {
    return <p className="px-6 py-6 text-sm italic text-stone-500">No messages yet.</p>;
  }

  return (
    <div>
      {messages.map((message) => {
        const isMine = message.senderId === viewerId;
        const displayName = isMine ? "You" : message.senderIsStaff && !revealStaffNames ? "Support Team" : message.senderName;
        return (
          <article
            key={message.id}
            className={`flex flex-col gap-2 border-t p-5 first:border-t-0 ${
              message.senderIsStaff ? "border-amber-200 bg-amber-50/60 dark:border-stone-800 dark:bg-amber-950/20" : "border-amber-100"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{displayName}</span>
              <span className="text-xs text-stone-500">{new Date(message.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
          </article>
        );
      })}
    </div>
  );
}
