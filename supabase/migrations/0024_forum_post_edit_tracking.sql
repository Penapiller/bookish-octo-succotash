-- "Last edited by X at TIME. This post has been edited N times." under
-- each post. last_edited_by matters because the editor isn't always the
-- original author — an admin can edit someone else's post too (see
-- "Authors and admins can edit a post" in 0021_forums.sql).
alter table public.forum_posts add column edit_count integer not null default 0;
alter table public.forum_posts add column last_edited_by uuid references public.users (id);

comment on column public.forum_posts.edit_count is
  'How many times body_raw has actually changed — bumped by track_forum_post_edit(), not the app. Never counts the original insert.';
comment on column public.forum_posts.last_edited_by is
  'Who made the most recent edit — may differ from author_id (an admin editing someone else''s post). Null until the first edit.';

-- Plain (not security definer) trigger — it only ever touches columns
-- on the same row the UPDATE statement is already allowed to touch
-- under "Authors and admins can edit a post", so it doesn't need to
-- bypass RLS the way sync_forum_thread_stats()/increment_thread_view_
-- count() do for a *different* table. BEFORE UPDATE (not AFTER, like
-- the reply-count sync trigger) so it can rewrite NEW.* before the row
-- is actually written, instead of issuing a second UPDATE.
--
-- Only bumps when body_raw actually changed, not on every UPDATE of the
-- row — there's only one UPDATE path today (the edit form), but this
-- keeps the semantics right if that ever changes.
create function public.track_forum_post_edit()
returns trigger
language plpgsql
as $$
begin
  if new.body_raw is distinct from old.body_raw then
    new.edit_count := old.edit_count + 1;
    new.last_edited_by := auth.uid();
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger track_forum_post_edit
  before update on public.forum_posts
  for each row execute function public.track_forum_post_edit();
