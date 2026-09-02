-- display_name becomes the player's unique, rate-limited handle: no two
-- accounts may share one (case-insensitively), and changing it costs 15
-- gems and can only be done once every 14 days. This repurposes the
-- existing free-form display_name column rather than adding a second
-- "username" field alongside it.

-- ── 1. De-duplicate any existing rows before the unique index can land ──
-- display_name has been unconstrained since 0001, so two accounts could
-- already share a name (most likely test accounts made while building
-- this app). For every case-insensitive duplicate group, the
-- earliest-created row keeps its name; every later row gets a numeric
-- suffix appended until it's unique, capped at the existing 40-char limit.
do $$
declare
  v_row record;
  v_candidate text;
  v_suffix integer;
begin
  for v_row in
    select id, display_name,
      row_number() over (
        partition by lower(display_name) order by created_at, id
      ) as dup_rank
    from public.users
  loop
    if v_row.dup_rank = 1 then
      continue;
    end if;

    v_suffix := v_row.dup_rank;
    loop
      v_candidate := left(v_row.display_name, 40 - length('-' || v_suffix)) || '-' || v_suffix;
      exit when not exists (
        select 1 from public.users
        where lower(display_name) = lower(v_candidate) and id <> v_row.id
      );
      v_suffix := v_suffix + 1;
    end loop;

    update public.users set display_name = v_candidate where id = v_row.id;
  end loop;
end;
$$;

-- ── 2. Uniqueness, case-insensitive ─────────────────────────────────────
create unique index users_display_name_unique_idx on public.users (lower(display_name));

-- ── 3. Rate-limit bookkeeping ────────────────────────────────────────────
-- Backfilled to created_at: an existing account's auto-assigned signup
-- name counts as its "last change" baseline, same as a brand-new account
-- (see handle_new_user below) — there's no free first customization
-- window, the 14-day/15-gem rule applies uniformly from account creation
-- onward.
alter table public.users
  add column display_name_changed_at timestamptz not null default now();

update public.users set display_name_changed_at = created_at;

comment on column public.users.display_name_changed_at is
  'When display_name was last set — either at account creation (handle_new_user) or via change_display_name(). Gates the 14-day cooldown.';

-- ── 4. Guard display_name/display_name_changed_at like the other
-- privileged columns — otherwise a plain client `.update()` could change
-- the name directly and skip the uniqueness/cooldown/cost checks that
-- only change_display_name() enforces below. Same signature as every
-- prior version (0001/0002/0011), so CREATE OR REPLACE is safe.
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

-- ── 5. Auto-assigned name at signup must itself be unique ───────────────
-- handle_new_user (0001) previously inserted Google's raw full_name/email
-- prefix as-is. Redefine it to sanitize that into a candidate and append
-- a numeric suffix until it's free, so the unique index above can never
-- reject a brand-new signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  v_base := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  v_base := left(regexp_replace(v_base, '\s+', ' ', 'g'), 34);
  if v_base is null or length(trim(v_base)) = 0 then
    v_base := 'Player';
  end if;

  v_candidate := v_base;
  while exists (select 1 from public.users where lower(display_name) = lower(v_candidate)) loop
    v_suffix := v_suffix + 1;
    v_candidate := left(v_base, 40 - length('-' || v_suffix)) || '-' || v_suffix;
  end loop;

  insert into public.users (id, google_sub, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'),
    new.email,
    v_candidate,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 6. The only way to change display_name from here on ─────────────────
create function public.change_display_name(p_user_id uuid, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_changed_at timestamptz;
  v_gem_balance integer;
  v_next_available timestamptz;
  v_cost constant integer := 15;
  v_cooldown constant interval := interval '14 days';
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  v_name := trim(regexp_replace(coalesce(p_new_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 3 then
    raise exception 'Name must be at least 3 characters.';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'Name must be 40 characters or fewer.';
  end if;

  select display_name_changed_at, gem_balance into v_changed_at, v_gem_balance
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found.';
  end if;

  v_next_available := v_changed_at + v_cooldown;
  if now() < v_next_available then
    raise exception 'You can change your name again on %.', to_char(v_next_available, 'YYYY-MM-DD');
  end if;

  if v_gem_balance < v_cost then
    raise exception 'Changing your name costs % gems — you have %.', v_cost, v_gem_balance;
  end if;

  if exists (
    select 1 from public.users
    where lower(display_name) = lower(v_name) and id <> p_user_id
  ) then
    raise exception 'That name is already taken.';
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set display_name = v_name,
      display_name_changed_at = now(),
      gem_balance = gem_balance - v_cost
  where id = p_user_id
  returning gem_balance into v_gem_balance;

  return jsonb_build_object(
    'display_name', v_name,
    'gem_balance', v_gem_balance,
    'next_change_available_at', now() + v_cooldown
  );
end;
$$;

revoke all on function public.change_display_name(uuid, text) from public;
grant execute on function public.change_display_name(uuid, text) to authenticated;
