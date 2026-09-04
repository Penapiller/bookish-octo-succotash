-- Moderator tools + a reports system, deliberately kept SEPARATE from the
-- admin panel rather than folded into it: moderators get content/safety
-- powers (pin/lock/delete forum content, review and resolve reports);
-- admins keep everything they already had (economy/catalog management,
-- the audit log) PLUS moderator powers, by having is_admin satisfy both
-- current_user_is_admin() and current_user_is_moderator() checks. A
-- moderator who isn't also an admin never passes current_user_is_admin()
-- and so never reaches /admin or any admin-only RLS policy.

alter table public.users add column is_moderator boolean not null default false;

comment on column public.users.is_moderator is
  'Grants /mod (reports queue, forum pin/lock/delete) but NOT /admin — see is_admin, which grants both. Set only by a trusted/service-role write, same protection as is_admin.';

-- Redefine (0014's version) to also protect the new column — same
-- shape/reasoning as every prior redefinition of this trigger.
create or replace function public.protect_privileged_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and coalesce(current_setting('app.trusted_user_write', true), 'false') <> 'true' then
    new.is_admin := old.is_admin;
    new.is_moderator := old.is_moderator;
    new.coin_balance := old.coin_balance;
    new.gem_balance := old.gem_balance;
    new.den_size := old.den_size;
    new.google_sub := old.google_sub;
    new.email := old.email;
    new.starter_granted := old.starter_granted;
    new.display_name := old.display_name;
    new.display_name_changed_at := old.display_name_changed_at;
  end if;
  return new;
end;
$$;

-- Staff check for moderator-or-admin gated RLS/pages — current_user_is_
-- admin() (0009) stays admin-only and untouched, since admin-only surfaces
-- (economy grants, catalog management, the audit log) must NOT open up to
-- a moderator who isn't also an admin.
create function public.current_user_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin or is_moderator from public.users where id = auth.uid()),
    false
  );
$$;

-- ── Forum moderation: widen pin/lock to moderators, add delete ─────────
-- Thread pin/lock/move was admin-only (0021) because moderation tooling
-- didn't exist yet. It's exactly a moderator's job now, so replace that
-- policy with the moderator-or-admin check.
drop policy "Admins can update any thread" on public.forum_threads;

create policy "Staff can update any thread"
  on public.forum_threads for update
  using (public.current_user_is_moderator())
  with check (public.current_user_is_moderator());

-- 0021 deliberately shipped without delete on threads/posts ("moderation/
-- removal is a later module") — this is that module. Deletion is a
-- moderator action, not a self-service one: authors can still edit their
-- own posts (existing policy, unchanged) but only staff can delete either
-- a thread or a post.
create policy "Staff can delete threads"
  on public.forum_threads for delete
  using (public.current_user_is_moderator());

create policy "Staff can delete posts"
  on public.forum_posts for delete
  using (public.current_user_is_moderator());

-- sync_forum_thread_stats (0021) only ever handled INSERT, since posts
-- had no delete path yet. Extend it to keep reply_count/last_post_at
-- correct when a post is removed too — last_post_at falls back to the
-- thread's own created_at if the deleted post was the only one left,
-- same as a freshly created empty-of-replies thread would show.
create or replace function public.sync_forum_thread_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.forum_threads
    set reply_count = reply_count + 1,
        last_post_at = new.created_at
    where id = new.thread_id;
    return new;
  else
    update public.forum_threads
    set reply_count = greatest(0, reply_count - 1),
        last_post_at = coalesce(
          (select max(created_at) from public.forum_posts where thread_id = old.thread_id),
          forum_threads.created_at
        )
    where id = old.thread_id;
    return old;
  end if;
end;
$$;

drop trigger sync_forum_thread_stats on public.forum_posts;
create trigger sync_forum_thread_stats
  after insert or delete on public.forum_posts
  for each row execute function public.sync_forum_thread_stats();

-- ── Reports ──────────────────────────────────────────────────────────
-- Two target kinds for this first version — a player (from /u/[id]) or a
-- forum post (from the thread view) — covering everywhere this app
-- already had a stubbed "Report" button waiting on this migration. DMs
-- aren't reportable yet (private 1:1 content raises different questions
-- about what a moderator should even be able to see); that's a natural
-- follow-up, not scope creep to force into this round.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'forum_post')),
  target_user_id uuid references public.users (id) on delete cascade,
  target_post_id uuid references public.forum_posts (id) on delete cascade,
  category text not null check (
    category in ('spam', 'harassment', 'inappropriate_content', 'scam', 'other')
  ),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.users (id),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  check (
    (target_type = 'user' and target_user_id is not null and target_post_id is null)
    or (target_type = 'forum_post' and target_post_id is not null and target_user_id is null)
  )
);

create index reports_status_created_at_idx on public.reports (status, created_at);

alter table public.reports enable row level security;

create policy "Players can file reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

create policy "Reporters can view their own reports; staff can view all"
  on public.reports for select
  using (reporter_id = auth.uid() or public.current_user_is_moderator());

create policy "Staff can resolve reports"
  on public.reports for update
  using (public.current_user_is_moderator())
  with check (public.current_user_is_moderator());

-- No delete policy — reports are a permanent record, same "never delete,
-- just change status" stance as admin-managed content elsewhere.

-- Reuses the existing generic audit trigger (0009) rather than a new
-- logging mechanism — every report filed AND every resolve/dismiss lands
-- in admin_audit_log with the actor's own id, exactly like an admin
-- catalog edit does. That log stays admin-only to read (its own SELECT
-- policy, unchanged), which is intentional: the reports queue itself
-- (moderator-readable) is the mod-facing view; the full audit trail
-- stays an admin tool.
create trigger audit_reports
  after insert or update on public.reports
  for each row execute function public.log_admin_action();
