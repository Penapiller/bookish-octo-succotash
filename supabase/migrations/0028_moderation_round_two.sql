-- Moderation round 2: a system "Staff" account for automated notices,
-- hidden-pending-review posts, richer reports (DM messages become
-- reportable, report history survives content deletion), and staff read
-- access to DM logs.

-- ── A real account for automated "from Staff" messages ──────────────────
-- Needed so an automatic notice (e.g. "your report was received") can be
-- a genuine DM rather than a special-cased non-DM notification — it
-- needs a real sender the existing dm_conversations/dm_messages schema
-- can reference like any other participant. Seeded directly into
-- auth.users (not through a real Google sign-in) using only the columns
-- every Supabase project's auth.users guarantees; handle_new_user()
-- (0001) then creates the matching public.users row automatically, using
-- raw_user_meta_data ->> 'full_name' as its display name — no separate
-- insert into public.users needed. Not an admin or moderator: it's a
-- puppet identity for one specific automated message, not a privileged
-- account of its own, and auth.uid() can never equal this id from a real
-- session (nobody can sign in as it).
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000001',
  'staff-system@internal.invalid',
  '{"full_name": "Staff Team"}'::jsonb
)
on conflict (id) do nothing;

-- ── Staff status becomes public info ────────────────────────────────────
-- Needed for colored staff names (moderator green / admin deep blue)
-- wherever a display name appears, and for showing "Edited by a
-- moderator/an admin" instead of a real name when staff edits someone
-- else's post. Both are meant to be visible to every player, not staff-
-- only — this view already excludes everything actually sensitive
-- (email, google_sub, currency_balance, den_size, is_admin was simply
-- never needed publicly before now).
-- New columns must be appended after the existing ones — CREATE OR
-- REPLACE VIEW can't reorder or insert columns into the middle of an
-- existing view's column list.
create or replace view public.user_profiles as
  select id, display_name, avatar_url, bio, created_at, is_admin, is_moderator
  from public.users;

-- ── Hidden-pending-review forum posts ────────────────────────────────────
alter table public.forum_posts add column is_hidden boolean not null default false;
alter table public.forum_posts add column hidden_at timestamptz;

comment on column public.forum_posts.is_hidden is
  'Set automatically once 5 distinct players have ever reported this post (see handle_new_report() below), or manually by staff (including the "test" toggle). Hidden posts still occupy their slot in the thread — reply_count/pagination unaffected — but render a placeholder to non-staff; staff still see the real content plus an unhide control.';

-- Editing (or hiding) someone else's post was admin-only; both are
-- moderator powers now — the same reasoning as forum_posts' staff-only
-- DELETE policy (0027_moderation.sql). Authors can still edit their own
-- post regardless of role, unchanged.
drop policy "Authors and admins can edit a post" on public.forum_posts;

create policy "Authors and staff can edit a post"
  on public.forum_posts for update
  using (auth.uid() = author_id or public.current_user_is_moderator())
  with check (auth.uid() = author_id or public.current_user_is_moderator());

-- ── Reports: DM messages become reportable, history survives deletion ───
alter table public.reports
  add column target_message_id uuid references public.dm_messages (id) on delete set null;

-- Snapshots of WHO authored the reported content, taken at report-filing
-- time (see snapshot_report_target_author() below) and never updated
-- afterward. Needed because target_post_id/target_message_id go null
-- once the content is deleted (see the SET NULL change below) — without
-- a snapshot, deleting a reported post would sever the only link this
-- report had to the player who wrote it, and /mod/players/[userId]
-- (this player's report history) would silently lose that entry.
alter table public.reports add column target_post_author_id uuid references public.users (id);
alter table public.reports add column target_message_sender_id uuid references public.users (id);

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user', 'forum_post', 'dm_message'));

-- Unlike target_user_id (target_type = 'user'), target_post_id/
-- target_message_id are NOT required to be non-null for their
-- respective types — the content they point at can be deleted later
-- (ON DELETE SET NULL below) and the report must survive that as a
-- legible historical record, just with its target gone. What the check
-- still guarantees is that a report's columns never straddle two
-- target kinds at once.
alter table public.reports drop constraint reports_check;
alter table public.reports add constraint reports_check
  check (
    (target_type = 'user' and target_user_id is not null and target_post_id is null and target_message_id is null)
    or (target_type = 'forum_post' and target_user_id is null and target_message_id is null)
    or (target_type = 'dm_message' and target_user_id is null and target_post_id is null)
  );

-- A resolved report ("how was this handled") must stay legible even
-- after the reported content is gone — a moderator deleting the
-- reported post is a NORMAL resolution (see deleteReportedPost), and
-- cascading the report away with it would erase exactly the history
-- /mod/players/[userId] exists to show. Switch from CASCADE to SET
-- NULL: the report row and its resolution are permanent regardless of
-- what later happens to the post.
alter table public.reports drop constraint reports_target_post_id_fkey;
alter table public.reports add constraint reports_target_post_id_fkey
  foreign key (target_post_id) references public.forum_posts (id) on delete set null;

-- ── Staff can read (not write) any DM conversation/messages ─────────────
-- "Staff can see DM logs between players" — a moderator reviewing a
-- reported message needs the surrounding conversation, not just the one
-- flagged message. Still read-only for staff: no insert/update/delete
-- policy changes, so having this doesn't let a moderator post into or
-- alter a conversation they're not a participant in.
drop policy "Participants can view their conversations" on public.dm_conversations;
create policy "Participants and staff can view conversations"
  on public.dm_conversations for select
  using (auth.uid() in (user_one_id, user_two_id) or public.current_user_is_moderator());

drop policy "Participants can view their messages" on public.dm_messages;
create policy "Participants and staff can view messages"
  on public.dm_messages for select
  using (
    exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and (auth.uid() in (c.user_one_id, c.user_two_id) or public.current_user_is_moderator())
    )
  );

-- Runs BEFORE INSERT (so it can set columns on NEW before the row is
-- written) — separate from handle_new_report() below (AFTER INSERT,
-- reacts to the row once it exists) purely because "snapshot the
-- author" and "react to the report" are different kinds of work, not
-- because ordering between them matters.
create function public.snapshot_report_target_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'forum_post' and new.target_post_id is not null then
    select author_id into new.target_post_author_id
    from public.forum_posts where id = new.target_post_id;
  elsif new.target_type = 'dm_message' and new.target_message_id is not null then
    select sender_id into new.target_message_sender_id
    from public.dm_messages where id = new.target_message_id;
  end if;
  return new;
end;
$$;

create trigger snapshot_report_target_author
  before insert on public.reports
  for each row execute function public.snapshot_report_target_author();

-- ── One trigger, two automated reactions to a new report ────────────────
-- 1. Sends the reporter a DM from the Staff account acknowledging their
--    report — same "bookkeeping via a trigger" pattern as everywhere
--    else in this app, rather than something every report-filing call
--    site has to remember to do. Inlines the same find-or-create-
--    conversation logic as get_or_create_dm_conversation() instead of
--    calling it directly — that function's own "auth.uid() must equal
--    p_user_id" check would reject this, since the player filing the
--    report is never the Staff account.
-- 2. For a forum_post report specifically: once 5 DISTINCT players have
--    ever reported the same post, hide it pending review. Distinct
--    reporters (not just report count) so one player can't hide a post
--    solo by reporting it five times.
create function public.handle_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_user_one uuid;
  v_user_two uuid;
  v_conversation_id uuid;
  v_ack_body text;
  v_distinct_reporters integer;
begin
  v_user_one := least(v_staff_id, new.reporter_id);
  v_user_two := greatest(v_staff_id, new.reporter_id);

  insert into public.dm_conversations (user_one_id, user_two_id)
  values (v_user_one, v_user_two)
  on conflict (user_one_id, user_two_id) do nothing;

  select id into v_conversation_id
  from public.dm_conversations
  where user_one_id = v_user_one and user_two_id = v_user_two;

  v_ack_body := 'Thanks for your report (' || replace(new.category, '_', ' ') ||
    '). Our moderation team will review it and take action if needed.';

  insert into public.dm_messages (conversation_id, sender_id, body)
  values (v_conversation_id, v_staff_id, v_ack_body);

  if new.target_type = 'forum_post' then
    select count(distinct reporter_id) into v_distinct_reporters
    from public.reports
    where target_post_id = new.target_post_id;

    if v_distinct_reporters >= 5 then
      update public.forum_posts
      set is_hidden = true, hidden_at = now()
      where id = new.target_post_id and not is_hidden;
    end if;
  end if;

  return new;
end;
$$;

create trigger handle_new_report
  after insert on public.reports
  for each row execute function public.handle_new_report();
