-- Moderation overhaul: tightens the report/warning loop toward "staff
-- are invisible, moderation is one-way, a ticket has one owner,
-- moderators cannot ban" — plus two new, smaller subsystems (ban
-- appeals, support tickets) that share the same claim-based staff
-- workflow without sharing a table.
--
-- Ban authority is the HYBRID model: moderators keep direct authority
-- over short (<=7 day) dm/sales/forums bans, same as before — but a
-- longer restriction or any account ban now requires escalating the
-- report to an admin instead of moderators being able to issue it
-- directly. Admins are never capped.

-- ── Reports: priority, auto-derived ─────────────────────────────────
-- Not staff-editable — purely a triage signal derived once, at filing
-- time, from the category the reporter picked. Harassment/scam jump the
-- queue; spam sinks to the bottom; everything else is normal.
create type public.report_priority as enum ('low', 'normal', 'high');

alter table public.reports add column priority public.report_priority not null default 'normal';

create function public.set_report_priority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.priority := case
    when new.category in ('harassment', 'scam') then 'high'
    when new.category = 'spam' then 'low'
    else 'normal'
  end;
  return new;
end;
$$;

create trigger set_report_priority
  before insert on public.reports
  for each row execute function public.set_report_priority();

-- ── Reports: escalation to an admin queue ───────────────────────────
-- A moderator who decides a case needs a longer/account ban can't issue
-- it themselves — they escalate instead. escalated_by/escalated_at/
-- escalation_reason/recommended_action are the moderator's side of the
-- handoff; the eventual outcome is still just resolved/dismissed
-- (resolved_by/resolution_note, already on this table) once an admin
-- acts on it — no separate "admin decision" column needed.
alter table public.reports drop constraint reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('open', 'escalated', 'resolved', 'dismissed'));

alter table public.reports add column escalated_by uuid references public.users (id);
alter table public.reports add column escalated_at timestamptz;
alter table public.reports add column escalation_reason text check (escalation_reason is null or char_length(escalation_reason) <= 1000);
alter table public.reports add column recommended_action text check (recommended_action is null or char_length(recommended_action) <= 200);

-- Once escalated, only an admin can touch the ticket further (resolve,
-- dismiss, un-escalate) — a plain moderator can still escalate it (the
-- row's status is 'open' at the moment they do, so this check passes)
-- but can't act on it again afterward. This is the real backstop behind
-- "Only admins can access the Admin Queue," not just a hidden UI tab.
drop policy "Staff can resolve reports" on public.reports;
create policy "Staff can resolve reports"
  on public.reports for update
  using (
    public.current_user_is_moderator()
    and (status <> 'escalated' or public.current_user_is_admin())
  )
  with check (public.current_user_is_moderator());

-- ── Bans: hybrid duration cap for moderators ─────────────────────────
-- Admins stay uncapped. A moderator can still issue a short dm/sales/
-- forums restriction directly (unchanged from 0029) but anything longer
-- than 7 days, or any account ban, now requires the escalation path
-- above instead — an admin issues it themselves from the escalated
-- ticket, which hits this same policy as current_user_is_admin().
drop policy "Staff can issue bans within their authority" on public.bans;
create policy "Staff can issue bans within their authority"
  on public.bans for insert
  with check (
    issued_by = auth.uid()
    and (
      public.current_user_is_admin()
      or (
        public.current_user_is_moderator()
        and ban_type <> 'account'
        and expires_at <= issued_at + interval '7 days'
      )
    )
  );

-- Rebrand the pseudo-account's display name to match the "invisible
-- staff" model — "Community Team" reads as an institution, not a
-- person, same reasoning the account itself already embodies. A plain
-- session-scoped SET (not SET LOCAL, which is transaction-scoped and
-- migrations run one statement per implicit transaction) so it's still
-- in effect for the UPDATE statement right after it — same trusted-write
-- escape hatch protect_privileged_user_fields() checks for
-- (0001_init_users.sql), reset immediately after so nothing later in
-- this file accidentally runs trusted.
select set_config('app.trusted_user_write', 'true', false);
update public.users set display_name = 'Community Team'
where id = '00000000-0000-0000-0000-000000000001';
select set_config('app.trusted_user_write', 'false', false);

-- ── DMs with Staff become one-way ────────────────────────────────────
-- "Moderation is one-way": a player can never send a message INTO a
-- conversation with the Staff account — every existing Staff-authored
-- message (report acks, staff warnings, quick quotes) already writes
-- through security-definer functions that bypass this policy entirely,
-- so the only thing this actually blocks is a PLAYER trying to reply.
-- The app additionally hides the reply box on that conversation for
-- clarity, but this is the real enforcement.
drop policy "Participants can send messages" on public.dm_messages;
create policy "Participants can send messages"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and sender_id <> '00000000-0000-0000-0000-000000000001'
    and not public.user_has_active_ban(sender_id, 'dm')
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
        and '00000000-0000-0000-0000-000000000001' not in (c.user_one_id, c.user_two_id)
        and not public.user_has_active_ban(
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end,
          'dm'
        )
    )
  );

-- ── Ban appeals ──────────────────────────────────────────────────────
-- Scoped to dm/sales/forums bans only (a `bans` row the player can
-- reach while still signed in and self-select via the existing "Players
-- can view their own bans" policy, 0029). Account bans are deliberately
-- NOT appealable in-app yet: the ban signs the player out immediately,
-- so there's no authenticated session left to file an appeal from, and
-- accepting an unauthenticated appeal would mean trusting a bare ban id
-- with no identity check — a real feature, not something to bolt on
-- here. One appeal per ban (unique constraint) — resubmitting isn't a
-- new appeal, it's the same one still pending.
create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  ban_id uuid not null references public.bans (id) on delete cascade unique,
  player_id uuid not null references public.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'approved', 'denied')),
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.appeals enable row level security;

create policy "Players can appeal their own bans"
  on public.appeals for insert
  with check (
    player_id = auth.uid()
    and exists (select 1 from public.bans where id = ban_id and user_id = auth.uid() and ban_type <> 'account')
  );

create policy "Players can view their own appeals; staff can view all"
  on public.appeals for select
  using (player_id = auth.uid() or public.current_user_is_moderator());

-- "Ideally, the person reviewing the appeal isn't the person who made
-- the original decision" — enforced here, not just a UI preference: a
-- staff member can update any appeal EXCEPT one on a ban they personally
-- issued.
create policy "Staff can review appeals they didn't issue the ban for"
  on public.appeals for update
  using (
    public.current_user_is_moderator()
    and exists (select 1 from public.bans where id = ban_id and issued_by <> auth.uid())
  )
  with check (public.current_user_is_moderator());

create trigger audit_appeals
  after insert or update on public.appeals
  for each row execute function public.log_admin_action();

-- ── Support tickets ──────────────────────────────────────────────────
-- Deliberately a separate pair of tables from reports/report_notes, not
-- a shared "ticket" table with a type column — a support ticket is a
-- two-way conversation (player and staff both reply) where a report is
-- one-way (a report never gets a staff reply, only an eventual DM
-- notice if it results in a warning). Mirrors reports' claim shape
-- (claimed_by/claimed_at) for a consistent staff workflow, but is
-- otherwise its own simple thing.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'closed')),
  claimed_by uuid references public.users (id),
  claimed_at timestamptz,
  closed_by uuid references public.users (id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_tickets_status_idx on public.support_tickets (status, created_at);

alter table public.support_tickets enable row level security;

create policy "Players can file support tickets"
  on public.support_tickets for insert
  with check (player_id = auth.uid());

create policy "Players can view their own tickets; staff can view all"
  on public.support_tickets for select
  using (player_id = auth.uid() or public.current_user_is_moderator());

-- Claim/close/reopen are staff-only — a player has no way to close their
-- own ticket early in this first version (same "staff drives the
-- workflow" shape as everything else in /mod).
create policy "Staff can update support tickets"
  on public.support_tickets for update
  using (public.current_user_is_moderator())
  with check (public.current_user_is_moderator());

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.users (id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_id_created_at_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

create policy "Ticket participants and staff can view messages"
  on public.support_ticket_messages for select
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.player_id = auth.uid() or public.current_user_is_moderator())
    )
  );

-- Either side can reply, but only while the ticket is still open —
-- closing it (staff-only) ends the exchange the same way a locked
-- Staff-warning DM does, rather than leaving it open to relitigate
-- forever. Staff can reopen (support_tickets UPDATE policy above) if a
-- closed ticket genuinely needs to continue.
create policy "Participants can send messages while the ticket is open"
  on public.support_ticket_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.status = 'open'
        and (t.player_id = auth.uid() or public.current_user_is_moderator())
    )
  );

-- Keeps a ticket's own updated_at-equivalent fresh without a denormalized
-- column to maintain by hand elsewhere — the list page just reads
-- support_tickets.created_at plus a max(message.created_at) join, so no
-- trigger is needed here at all (unlike dm_conversations, which has no
-- other way to sort/preview without one).
