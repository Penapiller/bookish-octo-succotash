import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SupportTicketMessageWithSender } from "@/lib/supabase/types";

// Shared by the player-facing /support/[ticketId] and the staff-facing
// /mod/support/[ticketId] — same message list, resolved once. Whether a
// staff reply's REAL name is shown to the viewer is a rendering decision
// (TicketThread's revealStaffNames prop), not something baked in here —
// senderIsStaff is enough for either view to decide.
export async function resolveTicketMessages(
  supabase: SupabaseClient<Database>,
  ticketId: string,
): Promise<SupportTicketMessageWithSender[]> {
  const { data } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  const messages = data ?? [];

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const { data: profiles } =
    senderIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, is_admin, is_moderator").in("id", senderIds)
      : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return messages.map((m) => {
    const profile = byId.get(m.sender_id);
    return {
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      senderId: m.sender_id,
      senderName: profile?.display_name ?? "Unknown",
      senderIsStaff: (profile?.is_admin || profile?.is_moderator) ?? false,
    };
  });
}
