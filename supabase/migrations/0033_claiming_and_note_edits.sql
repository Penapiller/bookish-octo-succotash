-- Two independent QOL additions requested after the simplified report-
-- handling round shipped:

-- ── Ticket claiming, restored ───────────────────────────────────────
-- Same design as the reverted 0030_report_tickets.sql: any staff member
-- can claim or unclaim any report, so two mods don't duplicate work —
-- there's deliberately no "only the claimant can unclaim" restriction,
-- so a claim never gets permanently stuck if that mod goes AFK. No new
-- RLS needed: reports' existing staff-only UPDATE policy ("Staff can
-- resolve reports", 0027_moderation.sql) already covers every column,
-- claimed_by/claimed_at included, and a player has no UPDATE policy on
-- reports at all.
alter table public.reports add column claimed_by uuid references public.users (id);
alter table public.reports add column claimed_at timestamptz;

comment on column public.reports.claimed_by is
  'Which staff member is actively working this report — separate from resolved_by, which records who closed it. Null means unclaimed.';

-- ── Player notes become editable by their author ────────────────────
-- Notes were write-once ("a running log, not an editable document",
-- 0032_simple_report_handling.sql) — staff asked to fix typos/add detail
-- to a note they already wrote. Scoped to the author only (not any
-- staff member), since these are attributed record entries, not a
-- shared free-for-all document; edited_at (null until the first edit)
-- mirrors forum_posts' edit-tracking convention (0024_forum_post_edit_
-- tracking.sql) enough to show "(edited)" without needing a full
-- edit_count/last_edited_by pair — a note has exactly one author, so
-- there's no "someone else edited this" case to track.
alter table public.player_notes add column edited_at timestamptz;

create policy "Authors can edit their own player notes"
  on public.player_notes for update
  using (public.current_user_is_moderator() and author_id = auth.uid())
  with check (public.current_user_is_moderator() and author_id = auth.uid());
