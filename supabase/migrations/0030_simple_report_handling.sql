-- A simpler replacement for the reverted ticket/overhaul rounds: players
-- can block another player after reporting them, staff get a private
-- per-player notes log, and reports regain a lightweight "escalated"
-- status (just the enum value — no queues, no admin-only lock, no extra
-- columns) for "send this to an admin instead of handling it myself."

-- ── Blocking ─────────────────────────────────────────────────────────
-- Self-service and one-directional: blocking someone stops THEM from
-- DMing YOU (enforced below), independent of and much lighter-weight
-- than a staff-issued dm ban (0029_bans_and_staff_fixes.sql) — a player
-- manages this themselves, no report or staff action required.
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;

create policy "Players can view their own blocks"
  on public.blocks for select
  using (blocker_id = auth.uid());

create policy "Players can create their own blocks"
  on public.blocks for insert
  with check (blocker_id = auth.uid());

create policy "Players can remove their own blocks"
  on public.blocks for delete
  using (blocker_id = auth.uid());

-- security definer so this can be called from the dm_messages policy
-- below regardless of the CALLER's own visibility into `blocks` — an
-- inline `exists (select 1 from public.blocks ...)` inside that policy
-- would silently be filtered by blocks' own "Players can view their own
-- blocks" SELECT policy (the sender isn't the blocker, so they can't see
-- the row that blocks them), making the block check a no-op. Same
-- reasoning as user_has_active_ban() (0029) needing security definer to
-- see bans rows the caller wouldn't otherwise be allowed to read.
create function public.is_blocked_by(p_blocked_id uuid, p_blocker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks where blocker_id = p_blocker_id and blocked_id = p_blocked_id
  );
$$;

-- Extends the existing dm-ban check (0029) with the same shape: the
-- other participant, derived from the conversation row, must not have
-- blocked the sender. Unlike a dm ban this is NOT bidirectional — the
-- point of blocking is "I don't want to hear from them," not "we can't
-- talk" — the blocker can still message the blocked player if they want
-- to.
drop policy "Participants can send messages" on public.dm_messages;
create policy "Participants can send messages"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and not public.user_has_active_ban(sender_id, 'dm')
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
        and not public.user_has_active_ban(
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end,
          'dm'
        )
        and not public.is_blocked_by(
          sender_id,
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end
        )
    )
  );

-- ── Private per-player staff notes ──────────────────────────────────
-- Dated and attributed to whichever staff member wrote it, shown on the
-- report-handling page for context ("has this player caused trouble
-- before?") — separate from resolution_note (the one-line "why this
-- report was closed," on the reports table itself). Staff-only, no
-- update/delete — a running log, not an editable document.
create table public.player_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index player_notes_user_id_created_at_idx on public.player_notes (user_id, created_at);

alter table public.player_notes enable row level security;

create policy "Staff can view player notes"
  on public.player_notes for select
  using (public.current_user_is_moderator());

create policy "Staff can add player notes"
  on public.player_notes for insert
  with check (public.current_user_is_moderator() and author_id = auth.uid());

-- ── Escalation, minimal version ──────────────────────────────────────
-- Just a status a report can be in — "send this to an admin instead of
-- handling it myself" — no separate queue table, no admin-only RLS lock,
-- no escalation-reason columns. Any staff member can still act on an
-- escalated report same as any other (reports' existing staff-wide
-- UPDATE policy, 0027_moderation.sql, is untouched); this is an
-- organizational signal, not an access-control boundary.
alter table public.reports drop constraint reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('open', 'escalated', 'resolved', 'dismissed'));
