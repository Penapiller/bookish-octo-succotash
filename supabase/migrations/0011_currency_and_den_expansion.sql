-- Two currencies: coins (base, earned in-game) and gems (premium). No
-- real-money purchase flow yet for either — deliberately deferred to a
-- later module ("we'll add a way to buy gems and coins with real money
-- later"). For now gems only move via the admin testing grant below.
--
-- currency_balance (0001) is renamed to coin_balance now that a second
-- currency exists, so the name stays unambiguous.
alter table public.users rename column currency_balance to coin_balance;
alter table public.users add column gem_balance integer not null default 0;

comment on column public.users.coin_balance is
  'Base in-game currency. Spending sinks so far: den expansion (expand_den). No real-money purchase path yet.';
comment on column public.users.gem_balance is
  'Premium currency. No earn/spend path yet outside the admin testing grant (admin_grant_self_currency) — a real-money purchase flow and gem sinks are later modules.';

-- protect_privileged_user_fields (0001, redefined in 0002 to add the
-- trusted-write escape hatch) referenced currency_balance by name;
-- redefine again for the rename plus the new gem_balance column. Same
-- signature (returns trigger, no params) as both prior versions, so
-- CREATE OR REPLACE is safe — unlike changing a parameter/return type,
-- which would need DROP FUNCTION first.
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
  end if;
  return new;
end;
$$;

-- den_size's flat 25 default (set in 0006, originally called out there as
-- a temporary testing value to be lowered later) is now the permanent
-- free baseline by design — this migration builds real coin-based
-- expansion on top of it instead of lowering it back down.
comment on column public.users.den_size is
  'Max pets the user may own. Starts at 25 (free baseline); expand_den() adds 25 more per purchase at an escalating coin cost.';

-- ── Den expansion ────────────────────────────────────────────────────────
-- Cost curve: 500 coins for the first +25 slots, x1.5 per expansion
-- already purchased (500, 750, 1125, 1688, 2531, ...). No hard cap on how
-- many times this can be bought — the escalating cost is the only
-- limiter. expansions_bought is derived from den_size rather than stored
-- separately, since den_size only ever changes through this function (or
-- the 25 default) — one fewer thing that could drift out of sync.
create function public.expand_den(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_den_size integer;
  v_coin_balance integer;
  v_expansions_bought integer;
  v_cost integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select den_size, coin_balance into v_den_size, v_coin_balance
  from public.users
  where id = p_user_id
  for update;

  v_expansions_bought := greatest(0, (v_den_size - 25) / 25);
  v_cost := round(500 * power(1.5::numeric, v_expansions_bought::numeric))::integer;

  if v_coin_balance < v_cost then
    raise exception 'Not enough coins: this expansion costs % coins, you have %', v_cost, v_coin_balance;
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set coin_balance = coin_balance - v_cost,
      den_size = den_size + 25
  where id = p_user_id;

  return jsonb_build_object('new_den_size', v_den_size + 25, 'coins_spent', v_cost);
end;
$$;

revoke all on function public.expand_den(uuid) from public;
grant execute on function public.expand_den(uuid) to authenticated;

-- ── Admin currency grant (testing tool) ─────────────────────────────────
-- Scoped to the calling admin's OWN account only — there is deliberately
-- no way to grant currency (or anything else) to a different account
-- from here, matching the "no in-app way to grant privileges to anyone
-- but me" rule the admin panel itself follows. Once a real economy
-- exists (earn sources, a purchase flow) this stays useful as a
-- dev/support tool even then, so it's not written as throwaway code.
create function public.admin_grant_self_currency(
  p_admin_user_id uuid,
  p_coin_delta integer,
  p_gem_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_coin_balance integer;
  v_gem_balance integer;
begin
  if auth.uid() is distinct from p_admin_user_id then
    raise exception 'Not authorized';
  end if;

  select is_admin into v_is_admin from public.users where id = p_admin_user_id;
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set coin_balance = greatest(0, coin_balance + p_coin_delta),
      gem_balance = greatest(0, gem_balance + p_gem_delta)
  where id = p_admin_user_id
  returning coin_balance, gem_balance into v_coin_balance, v_gem_balance;

  insert into public.admin_audit_log (admin_user_id, action_type, target_table, target_id, change_summary)
  values (
    p_admin_user_id,
    'update',
    'users.currency',
    p_admin_user_id::text,
    jsonb_build_object(
      'coin_delta', p_coin_delta,
      'gem_delta', p_gem_delta,
      'new_coin_balance', v_coin_balance,
      'new_gem_balance', v_gem_balance
    )
  );

  return jsonb_build_object('coin_balance', v_coin_balance, 'gem_balance', v_gem_balance);
end;
$$;

revoke all on function public.admin_grant_self_currency(uuid, integer, integer) from public;
grant execute on function public.admin_grant_self_currency(uuid, integer, integer) to authenticated;
