-- Forums switch from a WYSIWYG-or-raw-HTML editor to a single BBCode
-- editor (src/lib/bbcode.ts renders body_raw -> body_html now, instead
-- of sanitize-html cleaning up submitted HTML) — see that file for why
-- this is actually a *safer* boundary than before: a player never
-- submits HTML at all anymore, so there's no allowlist-of-arbitrary-HTML
-- to get wrong, just a fixed set of BBCode tags this app's own code
-- turns into HTML. editor_mode (wysiwyg vs. raw) has no meaning left —
-- there's only one editor now, and typing BBCode by hand instead of
-- clicking toolbar buttons *is* the "advanced" option, no separate mode
-- needed.
alter table public.forum_posts drop column editor_mode;

comment on column public.forum_posts.body_html is
  'Rendered HTML — the only column ever rendered. Produced server-side by bbcodeToHtml() (src/lib/bbcode.ts) from body_raw (BBCode source) on every insert/update.';

-- Thread list "Views" column (see the forum index redesign). Best-effort
-- and unauthenticated-friendly by design — like most forum view
-- counters, it's incremented on every thread-page load, not deduplicated
-- per visitor, and isn't meant to be precise, just a rough popularity
-- signal.
alter table public.forum_threads add column view_count integer not null default 0;

comment on column public.forum_threads.view_count is
  'Incremented on every thread-page load via increment_thread_view_count() — best-effort, not deduplicated per visitor.';

-- security definer so a page view can bump this even though the only
-- client-facing UPDATE policy on forum_threads is admin-only (see
-- 0021_forums.sql) — same technique sync_forum_thread_stats() uses.
-- Granted to anon as well as authenticated: forum threads are publicly
-- readable without signing in (see forum_threads' select policy), so
-- view-counting has to work for anonymous visitors too. This is the
-- first anon-granted function in this app — it's safe to open up
-- specifically because it does nothing but increment a public, non-
-- sensitive counter on a row the caller could already read.
create function public.increment_thread_view_count(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.forum_threads
  set view_count = view_count + 1
  where id = p_thread_id;
end;
$$;

grant execute on function public.increment_thread_view_count(uuid) to authenticated, anon;
