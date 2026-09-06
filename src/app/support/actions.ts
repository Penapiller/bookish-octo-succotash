"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateTicketState = { error: string } | null;

// Support tickets are two-way (unlike reports, which never get a staff
// reply) — see 0031_moderation_overhaul.sql's header comment on why
// these are separate tables rather than a shared "ticket" type.
export async function createTicket(
  _prevState: CreateTicketState,
  formData: FormData,
): Promise<CreateTicketState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (subject.length === 0) return { error: "Give your ticket a subject." };
  if (subject.length > 200) return { error: "Subject must be 200 characters or fewer." };
  if (body.length === 0) return { error: "Describe what's going on." };
  if (body.length > 4000) return { error: "Message must be 4000 characters or fewer." };

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({ player_id: user.id, subject })
    .select("id")
    .single();

  if (ticketError || !ticket) {
    return { error: `Could not create ticket: ${ticketError?.message ?? "unknown error"}` };
  }

  const { error: messageError } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticket.id, sender_id: user.id, body });

  if (messageError) {
    return { error: `Ticket created, but the first message failed to save: ${messageError.message}` };
  }

  redirect(`/support/${ticket.id}`);
}

export type SendTicketMessageState = { error: string } | null;

export async function sendTicketMessage(
  _prevState: SendTicketMessageState,
  formData: FormData,
): Promise<SendTicketMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (body.length === 0) return { error: "Type a message first." };
  if (body.length > 4000) return { error: "Messages must be 4000 characters or fewer." };

  const { error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, sender_id: user.id, body });

  if (error) {
    return { error: "Could not send that message — the ticket may be closed." };
  }

  revalidatePath(`/support/${ticketId}`);
  return null;
}
