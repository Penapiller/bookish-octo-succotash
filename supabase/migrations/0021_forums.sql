-- Forums (spec Phase 12): categories (admin-managed, self-referencing one
-- level deep for subcategories) containing threads containing posts.
--
-- Authorization is a mix of the two patterns already in this app:
-- categories are admin-only content, so they get the same real
-- INSERT/UPDATE RLS + audit-log trigger as items/species/zones
-- (0009_admin_panel.sql). Threads/posts are player-authored, so they get
-- the plain owner-checked RLS pet_folders uses (0012) rather than a
-- security-definer RPC — there's no currency/game-economy stake here,
-- just "you can only post as yourself," which `with check (auth.uid() =
-- author_id)` already enforces natively. The one thing that MUST happen
-- in application code regardless of which write path is used is HTML
-- sanitization (sanitize-html, Node-only) — the database just stores
-- whatever body_html a Server Action hands it, so every post-creating
-- Server Action is the real security boundary here, not the RLS policy.

-- ── Categories ───────────────────────────────────────────────────────
-- parent_id is nullable and self-referencing. By convention (enforced in
-- the admin UI, not the schema) only a NULL-parent ("top-level") category
-- can be chosen as a parent — this keeps the hierarchy exactly two levels
-- deep (category > subcategory) without needing a recursive depth check.
-- Both top-level categories and subcategories can directly hold threads
-- (a top-level category with no subcategories is just a flat forum).
create table public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.forum_categories (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  icon_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create index forum_categories_parent_id_idx on public.forum_categories (parent_id);

alter table public.forum_categories enable row level security;

create policy "Forum categories are viewable by everyone"
  on public.forum_categories for select
  using (true);

create policy "Admins can insert forum categories"
  on public.forum_categories for insert
  with check (public.current_user_is_admin());

create policy "Admins can update forum categories"
  on public.forum_categories for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- No delete policy — same reasoning as items/species/zones (0009):
-- threads already reference a category by the time anyone would want to
-- remove one. Deactivate (is_active = false) instead, which the forum
-- index hides.

create trigger audit_forum_categories
  after insert or update on public.forum_categories
  for each row execute function public.log_admin_action();

-- ── Threads ──────────────────────────────────────────────────────────
create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories (id),
  author_id uuid not null references public.users (id),
  title text not null check (char_length(title) between 1 and 200),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now()
);

create index forum_threads_category_id_idx on public.forum_threads (category_id);
create index forum_threads_author_id_idx on public.forum_threads (author_id);

comment on column public.forum_threads.reply_count is
  'Total posts in the thread including the first one — kept in sync by the sync_forum_thread_stats trigger on forum_posts, not maintained by hand.';
comment on column public.forum_threads.last_post_at is
  'Timestamp of the most recent post — same trigger. Drives "recently active" sort order on the thread list.';

alter table public.forum_threads enable row level security;

create policy "Forum threads are viewable by everyone"
  on public.forum_threads for select
  using (true);

create policy "Signed-in users can start threads in active categories"
  on public.forum_threads for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.forum_categories where id = category_id and is_active)
  );

-- Only admins can update a thread (pin/lock/move) — there's no author
-- self-edit of the title in this first version, which sidesteps needing
-- a column-level guard (like protect_privileged_user_fields) to stop a
-- regular author from pinning/locking their own thread via the same
-- update path.
create policy "Admins can update any thread"
  on public.forum_threads for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ── Posts ────────────────────────────────────────────────────────────
create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  author_id uuid not null references public.users (id),
  editor_mode text not null default 'wysiwyg' check (editor_mode in ('wysiwyg', 'raw')),
  body_raw text not null check (char_length(body_raw) between 1 and 20000),
  body_html text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index forum_posts_thread_id_idx on public.forum_posts (thread_id);
create index forum_posts_author_id_idx on public.forum_posts (author_id);

comment on column public.forum_posts.editor_mode is
  'Which editor produced body_raw — WYSIWYG (TipTap) or raw hand-typed HTML ("Code" mode, Toyhouse-style). Purely for re-opening the right editor on edit; body_html (what actually renders) is sanitized identically either way.';
comment on column public.forum_posts.body_raw is
  'Exactly what the editor produced/the player typed, before sanitization — kept so editing a post reloads their original formatting instead of the sanitized-and-therefore-lossy HTML. Never rendered directly.';
comment on column public.forum_posts.body_html is
  'Sanitized HTML — the only column ever rendered. Produced server-side by sanitizeForumHtml() (src/lib/sanitize-forum-html.ts) from body_raw on every insert/update, regardless of editor_mode.';

alter table public.forum_posts enable row level security;

create policy "Forum posts are viewable by everyone"
  on public.forum_posts for select
  using (true);

create policy "Signed-in users can reply in unlocked threads"
  on public.forum_posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.forum_threads
      where id = thread_id and not is_locked
    )
  );

create policy "Authors and admins can edit a post"
  on public.forum_posts for update
  using (auth.uid() = author_id or public.current_user_is_admin())
  with check (auth.uid() = author_id or public.current_user_is_admin());

-- No delete policy on threads or posts in this first version — same
-- "deactivate rather than delete" stance as the rest of the admin
-- content, extended here to player content too; moderation/removal is a
-- later module.

-- ── Keep forum_threads.reply_count/last_post_at in sync ────────────────
-- security definer so it can update forum_threads even though the only
-- client-facing UPDATE policy on that table is admin-only (see above) —
-- this is bookkeeping triggered by a post insert, not a thread edit, so
-- it shouldn't need one. Only fires on INSERT: posts have no delete path
-- yet (see above), so reply_count only ever grows.
create function public.sync_forum_thread_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.forum_threads
  set reply_count = reply_count + 1,
      last_post_at = new.created_at
  where id = new.thread_id;

  return new;
end;
$$;

create trigger sync_forum_thread_stats
  after insert on public.forum_posts
  for each row execute function public.sync_forum_thread_stats();
