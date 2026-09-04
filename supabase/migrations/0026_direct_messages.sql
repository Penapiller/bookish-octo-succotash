-- Player-to-player direct messages: one thread per pair of players (no
-- group chats), reusable as-is for replies (any message in an existing
-- conversation) and as the messaging primitive a future reports/
-- notifications system can build on top of, without those needing this
-- table itself.

-- One row per pair of players. user_one_id/user_two_id are always stored
-- in a canonical order (user_one_id < user_two_id, uuid has a well-defined
-- ordering) so a unique index on the pair prevents ever creating two
-- separate conversations for the same two players regardless of who
-- messages whom first.
create table public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references public.users (id) on delete cascade,
  user_two_id uuid not null references public.users (id) on delete cascade,
  -- Denormalized onto the conversation (kept in sync by
  -- sync_dm_conversation_on_message() below) so the inbox list can render
  -- a sorted list with a preview snippet from one query, instead of an
  -- N+1 "last message per conversation" lookup.
  last_message_at timestamptz not null default now(),
  last_message_body text,
  last_message_sender_id uuid references public.users (id) on delete set null,
  -- Per-participant read markers. Sending a message also bumps the
  -- *sender's own* marker (see the trigger) — you've obviously "read" the
  -- message you just sent — so unread state is simply
  -- last_message_at > my marker, with no separate "who does this concern"
  -- bookkeeping needed.
  user_one_last_read_at timestamptz,
  user_two_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dm_conversations_ordered_pair check (user_one_id < user_two_id),
  constraint dm_conversations_unique_pair unique (user_one_id, user_two_id)
);

comment on table public.dm_conversations is
  'One row per pair of players who have ever messaged each other. user_one_id/user_two_id are canonically ordered, not "sender/recipient" — see get_or_create_dm_conversation().';

alter table public.dm_conversations enable row level security;

create policy "Participants can view their conversations"
  on public.dm_conversations for select
  using (auth.uid() in (user_one_id, user_two_id));

-- No insert/update/delete policy: every write goes through the security
-- definer functions below, which enforce the canonical ordering and the
-- read-marker bookkeeping — there's no plain-client write this table
-- needs to support directly.

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint dm_messages_body_length check (char_length(body) between 1 and 4000)
);

create index dm_messages_conversation_id_created_at_idx
  on public.dm_messages (conversation_id, created_at);

alter table public.dm_messages enable row level security;

create policy "Participants can view their messages"
  on public.dm_messages for select
  using (
    exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
    )
  );

create policy "Participants can send messages"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
    )
  );

-- No update/delete policy: messages are permanent once sent (no
-- edit/unsend in this first version).

-- Keeps dm_conversations' denormalized preview/read-marker columns in
-- sync with the messages actually sent — same "bookkeeping via a
-- trigger, not app-computed values" pattern as sync_forum_thread_stats()
-- and track_forum_post_edit().
create function public.sync_dm_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_conversations
  set
    last_message_at = new.created_at,
    last_message_body = new.body,
    last_message_sender_id = new.sender_id,
    user_one_last_read_at = case
      when user_one_id = new.sender_id then new.created_at
      else user_one_last_read_at
    end,
    user_two_last_read_at = case
      when user_two_id = new.sender_id then new.created_at
      else user_two_last_read_at
    end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger sync_dm_conversation_on_message
  after insert on public.dm_messages
  for each row execute function public.sync_dm_conversation_on_message();

-- Finds the (canonically-ordered) conversation between two players,
-- creating it if it doesn't exist yet. Security definer so it can do the
-- find-or-insert atomically (ON CONFLICT DO NOTHING then SELECT) without
-- needing an insert policy on dm_conversations for plain clients.
create function public.get_or_create_dm_conversation(p_user_id uuid, p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_one uuid;
  v_user_two uuid;
  v_conversation_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;
  if p_user_id = p_other_user_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;
  if not exists (select 1 from public.users where id = p_other_user_id) then
    raise exception 'Player not found';
  end if;

  v_user_one := least(p_user_id, p_other_user_id);
  v_user_two := greatest(p_user_id, p_other_user_id);

  insert into public.dm_conversations (user_one_id, user_two_id)
  values (v_user_one, v_user_two)
  on conflict (user_one_id, user_two_id) do nothing;

  select id into v_conversation_id
  from public.dm_conversations
  where user_one_id = v_user_one and user_two_id = v_user_two;

  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_dm_conversation(uuid, uuid) from public;
grant execute on function public.get_or_create_dm_conversation(uuid, uuid) to authenticated;

-- Marks a conversation as read up to now for the calling participant.
-- Called when a player opens a thread; a no-op (0 rows) if they're not a
-- participant, matching the quiet-no-op convention used elsewhere in this
-- app for actions on rows that don't belong to the caller.
create function public.mark_dm_conversation_read(p_user_id uuid, p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.dm_conversations
  set
    user_one_last_read_at = case when user_one_id = p_user_id then now() else user_one_last_read_at end,
    user_two_last_read_at = case when user_two_id = p_user_id then now() else user_two_last_read_at end
  where id = p_conversation_id
    and p_user_id in (user_one_id, user_two_id);
end;
$$;

revoke all on function public.mark_dm_conversation_read(uuid, uuid) from public;
grant execute on function public.mark_dm_conversation_read(uuid, uuid) to authenticated;
