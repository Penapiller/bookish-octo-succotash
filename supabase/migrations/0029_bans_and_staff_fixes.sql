-- Moderation round 3: staff messages always send from the Staff pseudo-
-- account (never the acting mod's own account — mod anonymity), a
-- database-backed library of canned staff messages (admin-managed,
-- staff-readable), and a full ban system (DM/sales/forums/account),
-- time-based with a shared active-ban check reused across every
-- enforcement point.

-- ── Staff messages: always from the Staff account, never the mod's own ──
-- Previously sendStaffWarning (mod/actions.ts) sent from the acting
-- moderator's own account, reasoning that colored-name styling alone
-- signaled "this is staff." The user explicitly wants mod anonymity
-- instead — a player should never be able to tell WHICH moderator handled
-- their case, only that staff did. This RPC is the fix: it inlines the
-- same find-or-create-conversation logic as get_or_create_dm_conversation
-- (which it can't call directly — that function requires auth.uid() =
-- p_user_id, and the caller here is a moderator, not the Staff account)
-- and always inserts the message as STAFF_USER_ID. security definer lets
-- it write dm_messages directly, which also means it naturally bypasses
-- the DM-ban policy below without needing a special-cased exemption —
-- same reasoning as handle_new_report()'s automated acknowledgement DM.
-- Reused for both the warning-DM tool AND the new quick-quote button
-- (mod/report-card.tsx) — both are "staff sends this exact text to this
-- player," just with different callers composing the body.
create function public.send_staff_message(p_target_user_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_user_one uuid;
  v_user_two uuid;
  v_conversation_id uuid;
begin
  if not public.current_user_is_moderator() then
    raise exception 'Not authorized';
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'Message cannot be empty';
  end if;
  if char_length(p_body) > 4000 then
    raise exception 'Message must be 4000 characters or fewer';
  end if;
  if not exists (select 1 from public.users where id = p_target_user_id) then
    raise exception 'Player not found';
  end if;

  v_user_one := least(v_staff_id, p_target_user_id);
  v_user_two := greatest(v_staff_id, p_target_user_id);

  insert into public.dm_conversations (user_one_id, user_two_id)
  values (v_user_one, v_user_two)
  on conflict (user_one_id, user_two_id) do nothing;

  select id into v_conversation_id
  from public.dm_conversations
  where user_one_id = v_user_one and user_two_id = v_user_two;

  insert into public.dm_messages (conversation_id, sender_id, body)
  values (v_conversation_id, v_staff_id, p_body);

  return v_conversation_id;
end;
$$;

revoke all on function public.send_staff_message(uuid, text) from public;
grant execute on function public.send_staff_message(uuid, text) to authenticated;

-- ── Canned staff messages: admin-managed, staff-readable ───────────────
-- Was a hardcoded array in warning-dm-form.tsx. Same "deactivate rather
-- than delete" convention as every other admin-managed catalog in this
-- app (species/items/zones/forum_categories) — no delete policy.
create table public.canned_staff_messages (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 100),
  body text not null check (char_length(body) between 1 and 4000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.canned_staff_messages enable row level security;

create policy "Staff can view canned messages"
  on public.canned_staff_messages for select
  using (public.current_user_is_moderator());

create policy "Admins can insert canned messages"
  on public.canned_staff_messages for insert
  with check (public.current_user_is_admin());

create policy "Admins can update canned messages"
  on public.canned_staff_messages for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_canned_staff_messages
  after insert or update on public.canned_staff_messages
  for each row execute function public.log_admin_action();

-- Carries over the same 4 messages warning-dm-form.tsx used to hardcode,
-- so switching it to read from this table is a no-op for existing staff
-- workflows.
insert into public.canned_staff_messages (label, body, sort_order) values
  ('General guideline reminder', 'Please review our community guidelines. Continued violations may result in further action on your account.', 0),
  ('Content removed', 'Your recent content was removed for violating our community guidelines. Please keep future posts and messages respectful.', 1),
  ('Behavior warning', 'This is a warning regarding your recent behavior toward other players. Further incidents may result in a suspension.', 2),
  ('No action needed', 'Thanks for your patience — we looked into a recent report involving your account and no action was needed.', 3);

-- ── Bans ─────────────────────────────────────────────────────────────
-- Four independent ban types rather than one "banned" flag — a player can
-- hold several at once (e.g. a forums ban AND a sales ban), each with its
-- own reason/duration/issuer, and each lifted independently. Time-based:
-- expires_at is required (staff choose a duration when issuing), lifted_at
-- is the separate "an admin/mod ended this early" record — a ban that
-- simply expired has lifted_at still null, matching the resolved-status
-- convention elsewhere (reports: resolved vs. dismissed are tracked
-- separately from "still open").
create type public.ban_type as enum ('dm', 'sales', 'forums', 'account');

create table public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  ban_type public.ban_type not null,
  reason text check (reason is null or char_length(reason) <= 500),
  issued_by uuid not null references public.users (id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  lifted_at timestamptz,
  lifted_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  check (expires_at > issued_at)
);

create index bans_user_id_ban_type_idx on public.bans (user_id, ban_type);

alter table public.bans enable row level security;

create policy "Staff can view bans"
  on public.bans for select
  using (public.current_user_is_moderator());

-- A player can see their own ban history (not anyone else's) — needed so
-- the account-ban notice on the home page (post-login-check, see
-- /auth/callback) can show the reason/expiry, and so a DM/forums/sales-
-- banned player can see the same detail if they ever look. Combines with
-- the staff policy above via OR, same as any other multi-policy SELECT
-- table in this app.
create policy "Players can view their own bans"
  on public.bans for select
  using (user_id = auth.uid());

-- Account bans are admin-only to issue ("Admins are the only people that
-- can issue account bans") — the other three are a normal moderator power,
-- same tier as everything else in /mod.
create policy "Staff can issue bans within their authority"
  on public.bans for insert
  with check (
    issued_by = auth.uid()
    and (
      (ban_type <> 'account' and public.current_user_is_moderator())
      or (ban_type = 'account' and public.current_user_is_admin())
    )
  );

-- Lifting a ban early requires the same authority tier as issuing that
-- ban type — a moderator can lift a forums ban but not an account ban.
create policy "Staff can lift bans within their authority"
  on public.bans for update
  using (
    (ban_type <> 'account' and public.current_user_is_moderator())
    or (ban_type = 'account' and public.current_user_is_admin())
  )
  with check (
    (ban_type <> 'account' and public.current_user_is_moderator())
    or (ban_type = 'account' and public.current_user_is_admin())
  );

-- No delete policy — bans are a permanent record (lifted_at marks an early
-- end, same as reports' resolved/dismissed status never actually deleting
-- the row).

create trigger audit_bans
  after insert or update on public.bans
  for each row execute function public.log_admin_action();

-- Single reusable "is this user currently under this kind of ban" check —
-- avoids duplicating the same lifted_at/expires_at logic at every
-- enforcement point (DM insert x2 directions, forum insert x2, sales RPC
-- x2, account-ban login check). Left with default PUBLIC execute
-- privileges (not revoked), same as current_user_is_admin()/
-- current_user_is_moderator() — it's a predicate meant to be called from
-- inside RLS policies (which requires the evaluating role to have execute
-- on it) as well as directly by the app for a player's own friendly
-- pre-check messages and the account-ban login check.
create function public.user_has_active_ban(p_user_id uuid, p_ban_type public.ban_type)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bans
    where user_id = p_user_id
      and ban_type = p_ban_type
      and lifted_at is null
      and expires_at > now()
  );
$$;

-- ── Enforcement: DMs ─────────────────────────────────────────────────
-- Bidirectional per the spec ("Players are unable to DM these players
-- either!") — a dm-banned player can't send, AND nobody can send to
-- them. Derives "the other participant" from the conversation row itself
-- rather than needing a separate parameter. Reports are unaffected (a
-- separate table/policy) — a dm-banned player can still file a report,
-- matching "Players can still send in reports with this ban." Staff's
-- own send_staff_message() bypasses this entirely (security definer,
-- direct table write, not routed through this policy).
drop policy "Participants can send messages" on public.dm_messages;
create policy "Participants can send messages"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and not public.user_has_active_ban(sender_id, 'dm')
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
        and not public.user_has_active_ban(
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end,
          'dm'
        )
    )
  );

-- ── Enforcement: forums ──────────────────────────────────────────────
drop policy "Signed-in users can start threads in active categories" on public.forum_threads;
create policy "Signed-in users can start threads in active categories"
  on public.forum_threads for insert
  with check (
    auth.uid() = author_id
    and not public.user_has_active_ban(author_id, 'forums')
    and exists (select 1 from public.forum_categories where id = category_id and is_active)
  );

drop policy "Signed-in users can reply in unlocked threads" on public.forum_posts;
create policy "Signed-in users can reply in unlocked threads"
  on public.forum_posts for insert
  with check (
    auth.uid() = author_id
    and not public.user_has_active_ban(author_id, 'forums')
    and exists (
      select 1 from public.forum_threads
      where id = thread_id and not is_locked
    )
  );

-- ── Enforcement: marketplace sales ───────────────────────────────────
-- "Cannot make new listings, but can still purchase things!" — the check
-- goes only in the two listing-creation RPCs, buy_listing is untouched.
-- CREATE OR REPLACE (not drop+create) since the signature is unchanged
-- from 0019_marketplace_upgrades.sql.
create or replace function public.create_pet_listing(
  p_seller_id uuid,
  p_pet_id uuid,
  p_price_coins integer,
  p_price_gems integer,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_species_name text;
  v_species_image_url text;
  v_rarity public.rarity_tier;
  v_custom_name text;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if public.user_has_active_ban(p_seller_id, 'sales') then
    raise exception 'You are currently banned from creating marketplace listings.';
  end if;

  if p_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Invalid listing duration.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if exists (
    select 1 from public.marketplace_listings
    where pet_id = p_pet_id and status = 'active'
  ) then
    raise exception 'That pet is already listed.';
  end if;

  select s.name, s.image_url, p.rarity, p.custom_name
  into v_species_name, v_species_image_url, v_rarity, v_custom_name
  from public.pets p
  join public.species s on s.id = p.species_id
  where p.id = p_pet_id and p.owner_id = p_seller_id;

  if not found then
    raise exception 'Pet not found.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at,
    pet_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name
  )
  values (
    p_seller_id, 'pet', p_price_coins, p_price_gems, now() + (p_duration_days || ' days')::interval,
    p_pet_id, v_species_name, v_species_image_url, v_rarity, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

create or replace function public.create_item_listing(
  p_seller_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_price_coins integer,
  p_price_gems integer,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_have integer;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if public.user_has_active_ban(p_seller_id, 'sales') then
    raise exception 'You are currently banned from creating marketplace listings.';
  end if;

  if p_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Invalid listing duration.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be at least 1.';
  end if;

  select quantity into v_have
  from public.user_inventory
  where user_id = p_seller_id and item_id = p_item_id;

  if coalesce(v_have, 0) < p_quantity then
    raise exception 'You don''t have that many to list.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at, item_id, item_quantity
  )
  values (
    p_seller_id, 'item', p_price_coins, p_price_gems, now() + (p_duration_days || ' days')::interval,
    p_item_id, p_quantity
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

-- ── Enforcement: account bans ────────────────────────────────────────
-- No RLS/trigger can intercept Google's OAuth handshake itself — the sign-
-- in always succeeds. Enforcement instead happens in app code right after
-- (/auth/callback, checked via user_has_active_ban(user.id, 'account')):
-- on an active account ban the session is immediately signed back out and
-- the player is redirected to "/" with ban details, so "cannot log in"
-- means the session never survives past that check rather than the OAuth
-- flow being blocked mid-handshake.
