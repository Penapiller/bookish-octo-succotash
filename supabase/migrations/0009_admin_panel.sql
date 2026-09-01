-- Admin panel (spec Phase 11), scoped to the systems that already exist:
-- zones (+ loot table + pet pool), items, species, potion recipes (+
-- ingredients). Shop/economy config, statue/legacy pool management, and
-- user support tools are deliberately NOT included yet — they depend on
-- currency/den-expansion and statue-offerings modules that don't exist.
--
-- Authorization model: rather than one security-definer RPC per action
-- (which this app has used everywhere else, but would mean ~20 near-
-- identical functions across 4 entity types), admin-managed tables get
-- real INSERT/UPDATE/DELETE RLS policies gated on is_admin, so the admin
-- panel's Server Actions can use plain .insert()/.update()/.delete()
-- calls through the normal client. This is enforced at the database
-- level (not just app code) either way — the app's Server Actions also
-- independently re-check is_admin before attempting a write, per the
-- project's "never trust client state, check server-side" rule, but the
-- RLS policies here are the actual backstop if that check were ever
-- missed or bypassed.
--
-- Audit log: rather than remembering to call a "log this" function from
-- every admin action, a single generic trigger function is attached to
-- every admin-managed table. It's impossible to add a new admin write
-- path that forgets to audit-log it, since the logging happens at the
-- table level, not the call-site level.

create function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

-- ── Audit log ────────────────────────────────────────────────────────────
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users (id),
  action_type text not null,
  target_table text not null,
  target_id text not null,
  change_summary jsonb not null,
  created_at timestamptz not null default now()
);

comment on column public.admin_audit_log.admin_user_id is
  'Null for writes made outside the admin panel (migrations, seed data run as service role) — see log_admin_action(), which skips logging entirely when auth.uid() is null rather than record a meaningless null-admin row.';

alter table public.admin_audit_log enable row level security;

create policy "Admins can view the audit log"
  on public.admin_audit_log for select
  using (public.current_user_is_admin());

-- No insert/update/delete policy: only the trigger function below (as
-- table owner) ever writes to this table.

create function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_target_id text;
  v_summary jsonb;
begin
  -- A write with no authenticated caller is a migration/seed-data write,
  -- not a real admin action — don't clutter the log with it.
  if auth.uid() is null then
    if TG_OP = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if TG_OP = 'INSERT' then
    v_row := to_jsonb(new);
    v_summary := jsonb_build_object('new', v_row);
  elsif TG_OP = 'UPDATE' then
    v_row := to_jsonb(new);
    v_summary := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    v_row := to_jsonb(old);
    v_summary := jsonb_build_object('old', v_row);
  end if;

  -- Most admin-managed tables have a single `id` primary key; the
  -- junction tables (zone_pet_pool, etc.) have composite keys instead, so
  -- fall back to the whole row as the identifier for those.
  v_target_id := coalesce(v_row ->> 'id', v_row::text);

  insert into public.admin_audit_log (admin_user_id, action_type, target_table, target_id, change_summary)
  values (auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_target_id, v_summary);

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- ── Zones ────────────────────────────────────────────────────────────────
create policy "Admins can insert zones"
  on public.zones for insert
  with check (public.current_user_is_admin());

create policy "Admins can update zones"
  on public.zones for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- No delete policy: zones are referenced by expeditions, and the spec
-- describes toggling a zone active/inactive, not deleting it.

create trigger audit_zones
  after insert or update on public.zones
  for each row execute function public.log_admin_action();

-- ── Zone pet pool ────────────────────────────────────────────────────────
create policy "Admins can insert zone pet pool rows"
  on public.zone_pet_pool for insert
  with check (public.current_user_is_admin());

create policy "Admins can update zone pet pool rows"
  on public.zone_pet_pool for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admins can delete zone pet pool rows"
  on public.zone_pet_pool for delete
  using (public.current_user_is_admin());

create trigger audit_zone_pet_pool
  after insert or update or delete on public.zone_pet_pool
  for each row execute function public.log_admin_action();

-- ── Zone loot table ──────────────────────────────────────────────────────
create policy "Admins can insert zone loot table rows"
  on public.zone_loot_table for insert
  with check (public.current_user_is_admin());

create policy "Admins can update zone loot table rows"
  on public.zone_loot_table for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admins can delete zone loot table rows"
  on public.zone_loot_table for delete
  using (public.current_user_is_admin());

create trigger audit_zone_loot_table
  after insert or update or delete on public.zone_loot_table
  for each row execute function public.log_admin_action();

-- ── Items ────────────────────────────────────────────────────────────────
create policy "Admins can insert items"
  on public.items for insert
  with check (public.current_user_is_admin());

create policy "Admins can update items"
  on public.items for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- No delete policy: items already in a player's inventory (or referenced
-- by a recipe/loot table) shouldn't be removable out from under them —
-- deactivate (is_active = false) instead. Existing foreign keys would
-- reject most such deletes anyway, but not exposing the capability at all
-- is simpler than relying on that as the only guard.

create trigger audit_items
  after insert or update on public.items
  for each row execute function public.log_admin_action();

-- ── Species ──────────────────────────────────────────────────────────────
create policy "Admins can insert species"
  on public.species for insert
  with check (public.current_user_is_admin());

create policy "Admins can update species"
  on public.species for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- No delete policy, same reasoning as items — pets already reference a
-- species; deactivate instead.

create trigger audit_species
  after insert or update on public.species
  for each row execute function public.log_admin_action();

-- ── Potion recipes ───────────────────────────────────────────────────────
create policy "Admins can insert potion recipes"
  on public.potion_recipes for insert
  with check (public.current_user_is_admin());

create policy "Admins can update potion recipes"
  on public.potion_recipes for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_potion_recipes
  after insert or update on public.potion_recipes
  for each row execute function public.log_admin_action();

-- ── Potion recipe ingredients ────────────────────────────────────────────
create policy "Admins can insert potion recipe ingredients"
  on public.potion_recipe_ingredients for insert
  with check (public.current_user_is_admin());

create policy "Admins can update potion recipe ingredients"
  on public.potion_recipe_ingredients for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admins can delete potion recipe ingredients"
  on public.potion_recipe_ingredients for delete
  using (public.current_user_is_admin());

create trigger audit_potion_recipe_ingredients
  after insert or update or delete on public.potion_recipe_ingredients
  for each row execute function public.log_admin_action();
