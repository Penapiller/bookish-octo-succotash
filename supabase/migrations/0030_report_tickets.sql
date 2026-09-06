-- Report ticketing QOL: claiming (so two mods don't duplicate work on the
-- same report) and an internal notes thread (so a mod can leave context
-- for whoever picks it up next). Deduping multiple reports about the same
-- content into one "ticket" is deliberately NOT a schema change — reports
-- that share a target (same target_post_id/target_message_id/
-- target_user_id) are grouped in application code (see
-- groupReportsByTarget(), src/app/mod/resolve-reports.ts), so claim/
-- resolve/dismiss actions bulk-apply across every open report sharing a
-- target instead of needing a new "ticket" table to tie them together.

-- ── Claiming ─────────────────────────────────────────────────────────
-- No new RLS needed: reports' existing staff-only UPDATE policy ("Staff
-- can resolve reports", 0027_moderation.sql) covers every column,
-- claimed_by/claimed_at included. A player has no UPDATE policy on
-- reports at all, so they can never claim one.
alter table public.reports add column claimed_by uuid references public.users (id);
alter table public.reports add column claimed_at timestamptz;

comment on column public.reports.claimed_by is
  'Which staff member is actively working this report (or its ticket, if grouped with duplicates) — separate from resolved_by, which records who closed it. Null means unclaimed. Any staff member can claim or unclaim any report; there is no "only the claimant can unclaim" restriction, so a claim never gets permanently stuck if that mod goes AFK.';

-- ── Internal notes ───────────────────────────────────────────────────
-- Mirrors reports' own target_type/target_*_id shape (same three nullable
-- columns, same check constraint pattern) rather than a foreign key to
-- one specific report row — a note is about the ticket (the reported
-- content/player), not about whichever individual duplicate report
-- happened to be open when it was written. 100% staff-only, both to
-- write and to read: this is for staff handoff/context, never shown to
-- players, which is also why there's no author-anonymity concern here
-- the way there is for player-facing staff messages.
create table public.report_notes (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('user', 'forum_post', 'dm_message')),
  target_user_id uuid references public.users (id) on delete cascade,
  target_post_id uuid references public.forum_posts (id) on delete set null,
  target_message_id uuid references public.dm_messages (id) on delete set null,
  author_id uuid not null references public.users (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (
    (target_type = 'user' and target_user_id is not null and target_post_id is null and target_message_id is null)
    or (target_type = 'forum_post' and target_user_id is null and target_message_id is null)
    or (target_type = 'dm_message' and target_user_id is null and target_post_id is null)
  )
);

create index report_notes_target_idx on public.report_notes (target_type, target_user_id, target_post_id, target_message_id);

alter table public.report_notes enable row level security;

create policy "Staff can view report notes"
  on public.report_notes for select
  using (public.current_user_is_moderator());

create policy "Staff can add report notes"
  on public.report_notes for insert
  with check (public.current_user_is_moderator() and author_id = auth.uid());

-- No update/delete policy — an internal log entry, same "permanent record"
-- convention as reports/bans themselves.
