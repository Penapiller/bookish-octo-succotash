-- A top-level category that has subcategories is a pure divider — a
-- way to group forums visually, not a place threads live. Enforced here
-- as the real backstop (app code in src/app/forums/actions.ts and the
-- /new page both also check this, but only for a friendly error message
-- and to avoid showing a form that would just fail on submit — this RLS
-- policy is what actually stops it regardless of what the client sends).
--
-- A category with NO subcategories can still hold threads directly
-- (unchanged from 0021) — "a top-level category with no subcategories
-- is just a flat forum." Only a category that itself has children loses
-- posting rights.
drop policy "Signed-in users can start threads in active categories" on public.forum_threads;

create policy "Signed-in users can start threads in active categories"
  on public.forum_threads for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.forum_categories where id = category_id and is_active)
    and not exists (select 1 from public.forum_categories where parent_id = category_id)
  );
