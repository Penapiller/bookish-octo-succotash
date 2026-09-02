# Virtual Pet Site

A virtual pet adoption/collection game (Chicken Smoothie/Neopets-style): adopt
and hatch pets with layered customizable art, send them on expeditions, brew
potions, trade with other players, decorate a profile page, and post on the
forums.

Full product spec lives in project history; this README covers running what's
built so far.

## Tech stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database + Auth + Storage:** Supabase (Postgres)
- **Authentication:** Google OAuth only, via Supabase Auth — no passwords
- **Hosting (dev/test):** Vercel, connected to GitHub for preview deploys

## Build status

This project is being built one module at a time. Current state:

- [x] Project skeleton — Next.js + Tailwind + Supabase wired up
- [x] Google sign-in (Supabase Auth), basic account settings, profile page
- [x] Starter pet + one-time tutorial expedition (species/pets/zones/
      expeditions schema, shown on the profile page)
- [x] Expeditions map — an "Expeditions" tab with a clickable map of
      explorable zones, pet-pool preview, starting a timed expedition (one
      per zone at a time), and a return-to-claim popup once it resolves
      (keep the reward or send it away)
- [x] Items + inventory — zones now sometimes drop a crafting item instead
      of a pet (blue = pet art, green = item art, for easy testing)
- [x] Potions & brewing — a "Brewing" tab: a 3-slot brewing stand players
      fill with owned ingredients, a recipe-book popup showing
      every fixed, shared recipe for reference/testing, and matching the
      slots against the book to start a brew — a fixed 2-minute timer,
      then return and claim the finished potion the same way as an
      expedition. Five potions total: shorter expedition timers, a higher
      chance of finding an item instead of a pet, and a chance of a bonus
      second reward. Purple potion art; real potions are consumed on the
      expeditions map to apply their effect
- [x] Admin panel & audit log — an "Admin" tab (visible only to you) for
      managing zones (incl. pet pool + loot table), items, species, and
      potion recipes (incl. ingredients), plus a read-only audit log of
      every admin write. See Notes below for the architecture and the
      one-time SQL snippet that makes your account the admin — there's no
      in-app way to grant admin to anyone else, by design
- [x] Admin image uploads & search-to-add — item/species edit pages now
      have a real file upload (PNG/JPEG/WebP/GIF, 5 MB max) that replaces
      the placehold.co placeholder art, backed by a new Supabase Storage
      bucket; and the "add to pool" / "add to loot table" / "add
      ingredient" pickers are now type-to-search instead of a giant
      dropdown, so they stay usable as the catalog grows
- [ ] Layered pet art rendering, accessory equip/unequip
- [x] Currency & den expansion — two currencies, coins (base) and gems
      (premium), shown on the profile page; no real-money purchase flow
      yet (a later module). Den size's flat 25 default is now the
      permanent free baseline (not a temporary testing value anymore) —
      an "Expand den" button on the profile page spends coins for +25
      more slots at a time, at an escalating cost. `/admin/currency` lets
      you grant yourself coins/gems for testing in the meantime
- [x] Pets/items split, pet folders, and pet naming — the old
      "Inventory" tab is now two separate tabs, "Pets" and "Items"
      (`/inventory` still works, just redirects to `/pets`). Pets can be
      grouped into folders like Flight Rising's lairs, shown as tabs on
      `/pets` (All / each folder / Unsorted), each paginated at 25 pets
      per page — create/rename/delete a folder, and move any pet into
      one via a dropdown on its card. The items page has type tabs (All
      / Ingredients / Potions / Cosmetics). Chicken Smoothie-style pet
      naming: every pet starts unnamed (no species-name placeholder
      shown in its place, just a "+ Name this pet" prompt) until the
      owner sets a nickname
- [x] `game-assets/` drop folder for real art — see
      [`game-assets/README.md`](./game-assets/README.md)
- [x] Cream/parchment theme + wood-sign header — the site-wide color
      palette moved from a cool gray (zinc) to a warm cream/amber one,
      and the header/nav was redesigned as a wood-plank bar with a
      distinct account panel, plus real icon art (recipe book, edit
      pencil, error banners) replacing emoji/placeholder shapes in a
      few spots. See Notes below for exactly what did and didn't change
- [ ] Statue offerings
- [ ] Trading
- [ ] Profile customization (sanitized custom CSS/HTML)
- [ ] Forums

---

## Getting started (complete walkthrough)

This section assumes you've never done this before and walks through every
step: creating accounts, clicking through dashboards, and the exact values to
copy where. It's long on purpose — follow it top to bottom and skip nothing.

You'll end up with three free accounts/tools if you don't have them already:
**Node.js** (to run the code on your computer), a **Supabase** account (the
database, login system, and file storage), and a **Google Cloud** account
(so "Sign in with Google" works). Deploying it live later uses a fourth,
**Vercel**.

### Step 0: Install prerequisites

You need **Node.js** (version 20 or later) installed on your computer to run
this project locally.

- Go to [nodejs.org](https://nodejs.org) and download the "LTS" version for
  your operating system, then run the installer.
- Confirm it worked by opening a terminal (on Mac: Terminal app; on Windows:
  Command Prompt or PowerShell) and running:
  ```bash
  node -v
  ```
  You should see something like `v20.x.x` or higher print out. If you get a
  "command not found" error, the install didn't finish correctly — try
  reinstalling, or restart your terminal/computer.

You also need **git** and a copy of this code on your computer. If you're
reading this file already inside a cloned copy of the repository, you can
skip to Step 1. Otherwise:

```bash
git clone <this repository's URL>
cd bookish-octo-succotash
```

Then install the project's dependencies:

```bash
npm install
```

This downloads everything listed in `package.json` into a `node_modules`
folder. It's normal for this to take a minute and print some warnings.

### Step 1: Create a Supabase account and project

Supabase is a hosted Postgres database that also handles login ("auth") and
file storage for us, so we don't have to run our own database server.

1. Go to [supabase.com](https://supabase.com) and click **Start your
   project** (or **Sign in**). Sign up with GitHub or email — it's free.
2. Once logged in, you'll land on the Supabase dashboard. Click **New
   project**.
3. You may first be asked to create an **Organization** — if so, just give
   it any name (e.g. your username) and continue.
4. Fill in the "Create a new project" form:
   - **Name**: anything you like, e.g. `virtual-pet-site`.
   - **Database Password**: click "Generate a password" and then **copy it
     somewhere safe** (a notes app, password manager). You likely won't need
     it for this guide, but you will if you ever connect a database tool
     directly.
   - **Region**: pick whichever is closest to you geographically.
   - Leave the pricing plan on **Free**.
5. Click **Create new project**. It takes 1-2 minutes to provision — you'll
   see a progress screen. Wait for it to finish before continuing.

### Step 2: Copy your Supabase API keys

1. In your new project's dashboard, look at the left sidebar and click the
   gear icon **Project Settings** (near the bottom).
2. Click **API** in the settings sub-menu (in newer dashboards this may be
   under a section called **API Keys** or **Data API**).
3. You'll see a **Project URL** — it looks like
   `https://abcdefghijklmno.supabase.co`. Copy it.
4. Further down (or on the "API Keys" tab) you'll see an **anon** /
   **public** key — a long string starting with `eyJ...`. Copy it too.
   (Do **not** copy the `service_role` / secret key for this — that one must
   never be shared or put in frontend code.)

Keep this browser tab open — you'll come back to it in Step 4 and Step 6.

### Step 3: Run the database migration

This creates the `users` table and related security rules that the app
needs — without this step, sign-in will appear to work but the app will
error when it tries to load your profile.

1. In the Supabase dashboard sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open the file
   [`supabase/migrations/0001_init_users.sql`](./supabase/migrations/0001_init_users.sql)
   in this repository (in your code editor, or on GitHub), select all of its
   contents, and copy it.
4. Paste the whole thing into the Supabase SQL Editor.
5. Click **Run** (or press Ctrl/Cmd+Enter). You should see "Success. No rows
   returned" at the bottom. If you see a red error instead, see
   [Troubleshooting](#troubleshooting) below.

This one file sets up everything phase 1 needs: the `users` table, the
security rules (RLS policies) that keep each user's private data private,
and a trigger that automatically creates a profile row the first time
someone signs in.

Future development phases add more `.sql` files to that same folder — run
each new one the same way (SQL Editor → New query → paste → Run), **in
filename order**, since later files sometimes alter or build on earlier
ones. If your project already has `0001_...` applied and a new
`0002_...` (or later) file shows up in this repo, you only need to run the
new one — you don't need to re-run files you've already applied.



### Step 4: Set your environment variables

Environment variables are how the app gets your Supabase project's URL and
key without hard-coding secrets into the source code.

1. Back in your terminal, in the project folder, run:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open the new `.env.local` file in a text editor. Replace the placeholder
   values with the **Project URL** and **anon public key** you copied in
   Step 2:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmno.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-long-key-here
   ```
3. Save the file. `.env.local` is already excluded from git (see
   `.gitignore`), so it will never be committed or pushed — this is
   intentional, since it's specific to your machine/project.

### Step 5: Create a Google OAuth Client (so "Sign in with Google" works)

This is the fiddliest step, so follow it carefully. You're creating
credentials that let Supabase ask Google "is this person who they say they
are?" on your app's behalf.

**5a. Create (or select) a Google Cloud project**

1. Go to the [Google Cloud Console](https://console.cloud.google.com/). Sign
   in with any Google account.
2. At the top of the page, click the project dropdown (it may say "Select a
   project" or show an existing project name) and click **New Project**.
3. Give it a name, e.g. `virtual-pet-site`, and click **Create**. Wait a
   few seconds for it to be created, then make sure it's selected in that
   same dropdown at the top.

**5b. Configure the OAuth consent screen**

Google requires this before it will let you create credentials.

1. In the left sidebar (or the search bar at the top), find **APIs &
   Services → OAuth consent screen**.
2. Choose **User Type: External** (this lets any Google account sign in,
   which is what a public game site needs), then click **Create**.
3. Fill in the required fields:
   - **App name**: e.g. `Virtual Pet Site`
   - **User support email**: your email address
   - **Developer contact information**: your email address again
   - Everything else on this screen can be left blank/default.
4. Click through **Save and Continue** on the following screens (Scopes,
   Test users, Summary) without changing anything — the defaults are fine
   for development. You don't need to submit the app for Google's
   verification review to use it yourself or with a small group.

**5c. Create the OAuth Client ID**

1. In the left sidebar, go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials** at the top, then choose **OAuth client
   ID**.
3. **Application type**: choose **Web application**.
4. **Name**: anything, e.g. `Supabase Auth`.
5. Under **Authorized redirect URIs**, click **+ Add URI**. This is the
   important part — go back to your Supabase dashboard tab, open
   **Authentication → Sign In / Providers → Google** (you may need to
   expand "Google" in the list of providers), and copy the **Callback URL
   (for OAuth)** shown there. It looks like:
   ```
   https://abcdefghijklmno.supabase.co/auth/v1/callback
   ```
   Paste that exact URL into the Google Cloud "Authorized redirect URIs"
   field.
6. Click **Create**. A dialog pops up showing your **Client ID** and
   **Client Secret** — copy both (or leave the dialog open; you can also
   find these later on the Credentials page by clicking the client you just
   created).

**5d. Give Supabase the Client ID and Secret**

1. Back in the Supabase dashboard, on that same **Authentication → Sign In /
   Providers → Google** screen:
   - Toggle Google **on** (Enabled).
   - Paste the **Client ID** and **Client Secret** from step 5c into the
     matching fields.
   - Click **Save**.

**5e. Tell Supabase which URLs are allowed to receive the login redirect**

1. Still in Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to `http://localhost:3000` for now (you'll add your
   live production URL here too, once you deploy — see Step 7).
3. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/callback
   ```
   You can add more than one entry here (e.g. your Vercel URL later) — it's
   an allow-list, not a single value.
4. Click **Save**.

### Step 6: Run the app locally

```bash
npm run dev
```

Leave that running, then open [http://localhost:3000](http://localhost:3000)
in your browser. Click **Sign in**, then **Continue with Google**, and
complete the Google login popup/redirect. You should land back on the site,
signed in, on your profile page.

If anything goes wrong, check [Troubleshooting](#troubleshooting) below —
auth setup is the single most common thing to get slightly wrong on the
first try, and almost every failure mode has a specific fix there.

### Step 7 (optional): Deploy it live with Vercel

Vercel is a hosting service made by the creators of Next.js; connecting it
to your GitHub repository gives you a live URL and automatic "preview"
deployments for every branch/PR.

1. Push this repository to GitHub if it isn't already there.
2. Go to [vercel.com](https://vercel.com) and sign up/log in (using your
   GitHub account is easiest).
3. Click **Add New… → Project**, then find and **Import** your GitHub
   repository. Vercel auto-detects it's a Next.js app — you don't need to
   change any build settings.
4. Before clicking Deploy, expand **Environment Variables** and add the
   same two variables from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**. After it finishes, Vercel gives you a URL like
   `https://your-project.vercel.app`.
6. Update Supabase and Google so the live URL is allowed to sign in:
   - In Supabase **Authentication → URL Configuration**, add
     `https://your-project.vercel.app/auth/callback` to **Redirect URLs**
     (keep the localhost one too), and consider updating **Site URL** to
     your production domain once you have one you consider "final."
   - In Google Cloud **Credentials**, open your OAuth client from Step 5c
     and add `https://your-project.vercel.app` to Authorized JavaScript
     origins if prompted, and confirm the redirect URI list still contains
     your Supabase callback URL (it doesn't change — Google always redirects
     to Supabase, which then redirects to your app, so you generally only
     add new entries in Supabase's Redirect URLs, not in Google, when adding
     a new deployment domain).
7. Redeploy (or just push a new commit) after changing environment
   variables in Vercel — they only take effect on the next build.

---

## Troubleshooting

**"Error: Failed to load profile for the signed-in user" / a blank/error
page right after logging in**
The database migration (Step 3) probably wasn't run, or failed partway. Open
Supabase's **Table Editor** and check whether a `users` table exists under
the `public` schema. If not, re-run the SQL from
`supabase/migrations/0001_init_users.sql` in the SQL Editor and read the
error message it gives you — a common cause is running it twice (the second
run fails because the table/trigger already exists, which is harmless, but
means the first run likely already succeeded).

**Clicking "Continue with Google" does nothing, or shows a Supabase error
page like "Unsupported provider"**
Google sign-in isn't enabled/saved correctly in Supabase. Revisit Step 5d —
make sure the toggle is switched on and you clicked **Save** after pasting
the Client ID/Secret.

**Google shows "Error 400: redirect_uri_mismatch"**
The URL in Google Cloud Console's "Authorized redirect URIs" doesn't exactly
match Supabase's callback URL. Go back to Supabase **Authentication → Sign
In / Providers → Google** and re-copy the callback URL exactly (including
`https://` and no trailing slash), then update it in Google Cloud
**Credentials**. This is the single most common setup mistake.

**After logging in with Google, you land on an error page instead of
`/profile`, or get redirected back to `/login`**
Check Supabase **Authentication → URL Configuration**: your app's URL (e.g.
`http://localhost:3000/auth/callback`) must be listed under **Redirect
URLs**, exactly, including the `/auth/callback` path.

**`npm run dev` fails immediately, or the page shows a Supabase connection
error**
Double check `.env.local` exists (not just `.env.local.example`), has no
extra quotes or spaces around the values, and that you restarted `npm run
dev` after creating/editing it — Next.js only reads env vars at startup.

**You want a clean slate**
You can safely delete and re-run the SQL migration if something's broken,
or delete rows from the `users` table (Table Editor) to force the
auto-provisioning trigger to re-create a profile the next time that person
signs in.

---

## Notes for future modules

- Every admin-only action must check `is_admin` server-side (Server
  Component, Server Action, or Route Handler) — never trust client state.
  `proxy.ts` only refreshes the Supabase session cookie; it is not an
  authorization boundary.
- User-submitted profile CSS/HTML (not yet built) must be sanitized with a
  library like DOMPurify both before storage and before render, and scoped
  (container or sandboxed iframe) so it can't affect the rest of the site.
- Trading must be implemented as a single atomic database transaction (e.g.
  a Postgres function called via RPC) to avoid duplication or race
  conditions.
- Expeditions resolve **lazily**: there's no background job/cron in this
  phase, so `resolve_due_expeditions` runs on every profile/expeditions
  page load and settles any expedition whose timer has already elapsed.
  The countdown components also refresh their route once they hit zero,
  so a player watching the page sees it resolve without needing to
  manually reload. A real scheduled job (e.g. Supabase's pg_cron, or a
  Vercel Cron Job hitting a route handler) could replace or supplement
  this later if expeditions need to "complete" even while nobody has the
  page open (e.g. for push notifications) — not needed for the current
  feature set.
  - The tutorial expedition still auto-grants its pet the moment it
    resolves (unchanged, one-time onboarding step).
  - Non-tutorial (map) expeditions do **not** auto-grant on resolution
    anymore: `resolve_due_expeditions` rolls the species and parks it on
    the row as `pending_species_id` with `status = 'awaiting_claim'`, and
    only `claim_expedition_reward` (called from the "keep"/"send it away"
    buttons in `ClaimRewardModal`) either turns it into an actual pet or
    discards it. The roll itself happens once, at resolution time, not at
    claim time — re-opening the zone or the popup can't reroll it, only
    defer the keep/release decision. A zone (and the sent pet) stays
    locked from `start_expedition` for as long as an expedition sits in
    either `in_progress` or `awaiting_claim` — a player has to claim
    before sending that zone's next pet.
- Any privileged column on `users` (`is_admin`, `currency_balance`,
  `den_size`, `starter_granted`, …) is protected from direct client writes
  by a trigger (`protect_privileged_user_fields`, in
  `0001_init_users.sql`, extended in `0002_...sql`). Server-side game logic
  that legitimately needs to write one of these columns must call
  `begin_trusted_user_write()` first, in the same transaction — see
  `grant_starter_pet_and_tutorial` in
  `supabase/migrations/0002_pets_and_tutorial_expedition.sql` for the
  pattern. Forgetting this makes the write silently no-op (the trigger
  reverts it to the old value) rather than error, so if a future migration
  adds a new privileged column and a write to it seems to do nothing, this
  is the first thing to check.
- A zone "sometimes" dropping an item instead of a pet isn't a separate
  probability field anywhere — `pick_weighted_zone_reward` (in
  `0005_items_and_inventory.sql`) just runs the same weighted draw across
  a zone's `zone_pet_pool` **and** `zone_loot_table` rows combined. There's
  no admin-facing "pet vs. item chance" knob to build later; the mix is
  whatever each row's `drop_weight` implies, in whichever table. The
  tutorial's own roll (`grant_starter_pet_and_tutorial`) deliberately
  keeps using the older pet-only `pick_weighted_zone_species` instead, so
  it can never hand out an item — that's enforced by which function it
  calls, not just by the tutorial zone having no loot table rows.
- Items are crafting ingredients only (`item_type`: `ingredient` today;
  `cosmetic`/`potion` exist in the enum for later modules but aren't used
  yet). There's intentionally no `pet_accessories`-style equip mechanic
  for them — that's a separate future system for actual cosmetic items,
  not these.
- The rarity enum was renamed `pet_rarity` → `rarity_tier` in
  `0005_items_and_inventory.sql` once items needed the same tiers as pets.
  It's a metadata-only rename (`ALTER TYPE ... RENAME TO`) — no data
  migration needed, and the TypeScript side still calls it `PetRarity`
  (with an `ItemRarity` alias) rather than renaming every call site.
- **Ambiguous embeds**: a Supabase/PostgREST `select("...,items(...)")`
  only works unhinted while there's exactly one relationship path between
  the two tables — and that's true in **two** distinct shapes here, both
  needing the same fix but for different reasons:
  1. **Two direct FKs to the same table.** `expeditions` has two FKs to
     `items` (`pending_item_id`, `result_item_id`), so a plain
     `items(...)` embed from `expeditions` is ambiguous. Fixed in
     `claim-reward-modal.tsx` with `items!expeditions_pending_item_id_fkey(...)`.
     `pets` has the same latent double-FK from `expeditions` (`pet_id`,
     `result_pet_id`) — nothing embeds `pets` from `expeditions` yet, but
     the next query that does will need the same hint.
  2. **A direct FK *plus* a many-to-many path through a junction table.**
     `potion_recipes` has one direct FK to `items`
     (`output_potion_item_id`), but `potion_recipe_ingredients` has FKs to
     *both* `potion_recipes` and `items` — PostgREST treats that as a
     second, implicit many-to-many relationship between them. So
     `potion:items(...)` embedded from `potion_recipes` (directly on
     `/brewing`, and nested inside `potion_recipes(items(...))` when
     reading a brew's potion from `potion_brews`) was ambiguous the exact
     same way, fixed in `brewing/page.tsx` with
     `items!potion_recipes_output_potion_item_id_fkey(...)`. This shape is
     easy to miss: a plain `pg_constraint` count *between the two tables
     you're embedding* looks fine (exactly one FK) — you only find it by
     also checking whether some third table has FKs to both sides. Any
     table with a junction table to another (`zone_pet_pool`,
     `zone_loot_table`, `potion_recipe_ingredients`, …) is safe to embed
     *from that junction table itself* (only one path exists looking
     outward from the many-side); the risk is only when embedding
     *from the "one" side that also has its own direct FK* to the same
     target.

  In both shapes: this never fails typecheck or build, since the embed
  string is just a string — it only surfaces when the query actually
  runs. Find the real constraint name rather than guessing at it:
  `select conname from pg_constraint where conrelid = '<table>'::regclass
  and confrelid = '<target>'::regclass;` for shape 1, or
  `... where conrelid = '<junction_table>'::regclass` (no `confrelid`
  filter) to see every table a junction connects, for shape 2.
- Species/zone art currently just points at
  [placehold.co](https://placehold.co) placeholder images, and zone/species
  names and descriptions are explicitly placeholder text (not real game
  content) — both are meant to be replaced once real art assets exist and
  the admin panel can manage them.
- Potions are real (`0006_potions_and_brewing.sql`, effects extended in
  `0008_potion_effects_and_brew_timers.sql`): the expeditions map's potion
  dropdown passes the chosen potion's item id as `start_expedition`'s
  `p_potion_item_id`, which looks up that potion's recipe for its
  `effect_type`/`effect_magnitude`, consumes one from `user_inventory`,
  and applies it — still never a guarantee, just a shifted range/chance,
  per spec. Four effect types now exist:
  - `duration_reduction`: shaves that fraction off the randomized 2-3
    minute base roll.
  - `item_find_boost`: multiplies item (not pet) weights in
    `pick_weighted_zone_reward`'s roll, biasing toward finding an item.
  - `double_reward_chance`: sets the probability (in place of the 5% base
    every non-tutorial expedition already has) that resolving rolls a
    bonus second reward, granted alongside the primary one if — and only
    if — the player keeps it; releasing forfeits both.
  - `rarity_boost` is still defined in the enum and a potion can be
    brewed with it, but nothing reads it — it's for biasing toward rarer
    outcomes *within* a pool, a different idea from `item_find_boost`
    (which biases pet-vs-item at the top level), and not implemented yet.

  Because `item_find_boost`/`double_reward_chance` are consumed at
  `start_expedition` time but only matter later at `resolve_due_expeditions`
  time, `expeditions` carries `item_find_bias` / `double_reward_chance` /
  `is_double_reward` columns to bridge that gap — purely internal
  bookkeeping the app never queries directly. `claim_expedition_reward`'s
  return type changed from a plain pet id to jsonb
  (`{granted_pet_id, bonus_kind?, bonus_name?, bonus_image_url?}`) so the
  claim popup can show a "🎉 double reward!" screen when a bonus was
  granted.
- Recipes are fixed and identical for every player — no per-user
  discovery/unlock state, matching spec ("no player-driven discovery at
  launch"). The recipe book (book icon on `/brewing`) shows every active
  recipe to everyone unconditionally; new recipes are added via
  `/admin/recipes` now (see the Admin panel notes below) the same way
  zones/items/species are.
- The slot-filling UI (`brewing-stand.tsx`) is a **client-side staging
  area only** — dragging/clicking ingredients into the 3 slots doesn't
  touch the database at all. It just computes, locally, whether the
  slots' contents exactly match some recipe's ingredient list, and if so
  enables "Start brewing", which calls `start_brew(recipe_id)` —
  re-verifying ownership and doing the atomic deduct server-side,
  regardless of how the client arrived at that recipe id. This matters
  for one thing: the UI has exactly **3 slots**, a hard cap — a recipe
  needing more than 3 total ingredient units (e.g. 2 of one item + 2 of
  another) could never be assembled by a player even though the database
  would happily store such a recipe. Keep future recipes at 3 total units
  or fewer, or grow `SLOT_COUNT` if that constraint ever needs to change.
- Brewing is timed, mirroring expeditions: `start_brew` spends the
  ingredients immediately and opens a `potion_brews` row
  (`in_progress` → `awaiting_claim` → `completed`, same lazy
  `resolve_due_brews` pattern as `resolve_due_expeditions` — called on
  every `/brewing` page load), with a **fixed** 2-minute timer (not
  randomized like expedition duration — brewing is a deliberate recipe
  pick, not a loot roll, so there's nothing to vary). Only one brew at a
  time per player, since there's one physical stand. Unlike expedition
  claims, `claim_brew` has no keep/release choice — you already spent the
  ingredients on purpose, so there's no reason to decline the result;
  clicking "Collect" always grants it. `brew_potion` from 0006 no longer
  exists (dropped in 0008) — it's fully replaced by
  `start_brew`/`resolve_due_brews`/`claim_brew`.
- **A real `ALTER TYPE ... ADD VALUE` gotcha, hit in
  `0008_potion_effects_and_brew_timers.sql`**: Postgres refuses to let a
  brand-new enum value be *used* — not just referenced inside a stored
  function body, but actually cast as data (e.g. in an `INSERT`) — within
  the same transaction that added it. Earlier migrations only ever
  referenced new enum values inside `plpgsql` function bodies, which
  aren't evaluated until a later, separate call, so this never came up.
  0008 seeds potion rows using the two enum values it just added in the
  same file, which — when the whole file runs as one implicit transaction
  (verified locally with `psql -1`, which is how Supabase's SQL Editor
  behaves when you paste and run a multi-statement script) — hit exactly
  this error. Fixed with an explicit `commit;` right after the
  `ALTER TYPE` statements, forcing them to land before anything later in
  the file can touch them, regardless of how the file is executed. Any
  future migration that both adds an enum value **and** inserts/updates a
  row using that value needs the same `commit;` in between.
- `users.den_size` was raised from 3 to **25** in `0006_potions_and_brewing.sql`,
  originally called out there as a temporary testing value to lower back
  down later. `0011_currency_and_den_expansion.sql` settled that instead
  of reverting it: 25 is now the permanent free baseline, with real
  coin-based expansion (`expand_den`) built on top — see the Currency &
  den expansion note below.
- A next/image quirk worth knowing if you add more images: Tailwind's
  Preflight CSS resets `img { height: auto }` globally, which fights with
  next/image's fixed `width`/`height` props unless you *also* pin both
  dimensions via a matching Tailwind class (e.g. `width={64} height={64}
  className="h-16 w-16"`) — otherwise Next.js logs an "either width or
  height modified, but not the other" warning in dev. Images using `fill`
  instead of `width`/`height` aren't affected (its inline styles already
  win over Preflight).
- **Admin panel (`0009_admin_panel.sql`, `/admin/*`)** — scoped to the
  systems that already exist: zones (+ pet pool + loot table), items,
  species, and potion recipes (+ ingredients). Shop/economy config, statue
  offerings, and user support tools aren't included yet since those
  modules don't exist.
  - **You are the only admin, by design** — there's no "manage other
    admins" UI anywhere in the app, on purpose (that was an explicit
    requirement, not an oversight). The only way `is_admin` ever becomes
    `true` is a one-time SQL statement you run yourself:
    ```sql
    update public.users set is_admin = true where email = 'you@example.com';
    ```
    Run this once in the Supabase SQL Editor (after running
    `0009_admin_panel.sql`), substituting your own account's email. It
    works there specifically because the SQL Editor runs as the
    `service_role`/no-JWT context, which is the one case
    `protect_privileged_user_fields` (0001) lets `is_admin` through — the
    app itself can never write that column (see below).
  - **Authorization is enforced twice**, deliberately redundant: every
    `/admin/*` page and every Server Action calls `requireAdmin()`
    (`src/lib/admin.ts`), which redirects non-admins away — but per this
    project's own rule (and Next.js's own docs) that render-time gating
    isn't a sufficient boundary by itself, the real backstop is the
    database: `zones`, `zone_pet_pool`, `zone_loot_table`, `items`,
    `species`, `potion_recipes`, and `potion_recipe_ingredients` all got
    real INSERT/UPDATE(/DELETE) RLS policies gated on a
    `current_user_is_admin()` helper (a `security definer` function so it
    doesn't depend on the calling role having schema-level access to
    `auth`). Even if every Server Action's admin check were somehow
    bypassed, a non-admin's write would still be rejected at the database
    level.
  - This is a different authorization pattern than the rest of the app:
    everywhere else, writes go through one security-definer RPC per
    action (`start_expedition`, `claim_brew`, etc.), each re-validating
    `auth.uid()`. For the admin panel that would mean ~20 near-identical
    functions across 4 entity types, so instead the tables themselves got
    real write policies and the Server Actions use plain
    `.insert()`/`.update()`/`.delete()` through the normal client.
  - **Audit log**: rather than a "log this" call at every admin action
    site (easy to forget on a new one), a single generic trigger function
    (`log_admin_action()`) is attached to every admin-managed table. It
    builds an `{old, new}` jsonb diff, resolves `target_id` from the row's
    `id` column where one exists and falls back to the whole row as JSON
    for the composite-key junction tables (`zone_pet_pool`,
    `zone_loot_table`, `potion_recipe_ingredients`), and — importantly —
    **skips logging entirely when `auth.uid()` is null**, so migration-time
    seed data and any future service-role script don't clutter the log
    with meaningless "admin: null" rows. `/admin/audit-log` is read-only;
    nothing ever writes to `admin_audit_log` except that trigger.
  - `zones`, `items`, and `species` deliberately have **no delete policy**
    — only insert/update. Zones are referenced by expedition history,
    items by inventories/recipes/loot tables, and species by owned pets;
    "delete" in the admin panel means toggling `is_active = false`
    instead. `zone_pet_pool`, `zone_loot_table`, and
    `potion_recipe_ingredients` (junction/pool rows, not content) do allow
    delete, since removing one row there just means "this thing no longer
    drops here" / "this ingredient is no longer required," not destroying
    referenced history.
  - `zones.is_tutorial` is intentionally **not editable** from
    `/admin/zones` — it's a one-time seed flag for the single tutorial
    zone, and the edit page hides the pet-pool/loot-table sections
    entirely for that zone (its pool is fixed in code, not
    database-driven).
  - The brewing stand only has **3 ingredient slots** and requires an
    exact match (see the recipes note above) — `/admin/recipes/[id]`'s
    "add ingredient" form enforces this by capping the total ingredient
    quantity at 3 server-side (`addIngredient` in
    `src/app/admin/recipes/actions.ts`), so you can't accidentally create
    a recipe nobody could ever brew.
  - Verified against a local Postgres 16 instance the same way every
    other migration in this project has been: both `psql -f`
    (autocommit-per-statement) and `psql -1` (single implicit transaction,
    matching how the Supabase SQL Editor runs a pasted script) apply
    cleanly, and RLS behavior was
    checked directly by role-switching (`set role authenticated; set
    request.jwt.uid = '<uuid>';`) as both an admin and a non-admin
    account — non-admin writes are rejected, admin writes succeed and are
    audit-logged with correct old/new diffs, and writes with no
    authenticated caller (`auth.uid()` null) are correctly never logged.
    One real thing this testing caught: `current_user_is_admin()` was
    initially written as a plain (non-`security definer`) SQL function,
    which works fine on a real Supabase project (Supabase grants
    `authenticated`/`anon` `USAGE` on the `auth` schema by default) but
    would silently depend on that external grant rather than being
    self-contained — changed to `security definer` to match the
    convention every other cross-cutting helper in this codebase already
    follows.
- **Admin image uploads (`0010_game_image_storage.sql`,
  `src/lib/game-image-upload.ts`)** — a Supabase Storage bucket
  (`game-images`, public, 5 MB/file cap, PNG/JPEG/WebP/GIF only) that
  admins can upload item/species art into from `/admin/items/[id]` and
  `/admin/species/[id]`. Read access is public (players need to load the
  images); write access is gated by the same `current_user_is_admin()`
  RLS pattern as every other admin table in 0009 — verified locally the
  same way, by role-switching as an admin vs. a non-admin account against
  `storage.objects`.
  - Each row gets exactly **one** file, at a stable path
    (`items/<id>.<ext>` / `species/<id>.<ext>`) uploaded with
    `upsert: true` — re-uploading replaces it rather than accumulating
    orphaned files. Since the path doesn't change on re-upload, the
    stored `image_url` has a `?v=<timestamp>` cache-busting query param
    appended so browsers/next/image actually pick up the new file instead
    of serving a cached copy of the old one at the same URL.
  - The upload happens **inside the same Server Action** as
    creating/editing the row (`createItem`/`updateItem`,
    `createSpecies`/`updateSpecies`), using the admin's own session — not
    a separate client-side upload step — so it's covered by the same
    `requireAdmin()` check and storage RLS as everything else. On create,
    the row is inserted first (to get an id to key the file's path on),
    then the file is uploaded and `image_url` is patched in a second
    write.
  - The old "Image URL" text field is still there as a fallback — paste
    an external URL (still handy for `placehold.co` placeholders while
    testing) and it's used whenever no file is uploaded.
  - `next.config.ts` already allowlisted `*.supabase.co/storage/v1/object/**`
    for `next/image` from the very first module, anticipating this.
- **Search-to-add pickers (`src/components/admin/searchable-picker.tsx`)**
  — the zone pet-pool/loot-table "add" forms and the recipe ingredient
  "add" form used to be a plain `<select>` listing every active
  species/item, which stops being usable once the catalog grows past a
  screenful. `SearchablePicker` is a small client component that filters
  a passed-in option list by name as you type and, once you pick one,
  renders a plain hidden `<input>` with that id — so it drops into the
  existing native `<form action={serverAction}>` (a Server Component)
  without needing to convert the whole form into a client component or
  change the Server Action at all.
- **Currency & den expansion (`0011_currency_and_den_expansion.sql`)** —
  two currencies on `users`: `coin_balance` (base, renamed from
  `currency_balance` now that a second currency exists) and `gem_balance`
  (premium, new). Neither has a real-money purchase path yet — that's a
  deliberately deferred later module — so for now gems only ever move via
  the admin testing grant below, and coins only ever move via
  `expand_den`.
  - `protect_privileged_user_fields` (0001, extended in 0002 with the
    trusted-write escape hatch) already blocked client writes to
    privileged columns including the old `currency_balance`/`den_size`;
    redefined again here for the rename plus `gem_balance`. Any RPC that
    writes one of these columns must call `begin_trusted_user_write()`
    first (inside the same transaction) or the trigger silently resets
    the column back to its old value — this bit both new functions below
    during local testing before that call was added, exactly as intended
    (it's the same protection that stops a compromised/malicious client
    from writing these columns directly).
  - **`expand_den(p_user_id)`** — a normal self-only player RPC (`auth.uid()
    = p_user_id`, same pattern as `start_expedition`/`claim_brew`/etc.),
    row-locks the caller's own row, and adds 25 to `den_size` for an
    escalating coin cost: 500 for the first expansion, ×1.5 per
    expansion already bought (500, 750, 1125, 1688, 2531, …), derived
    from `den_size` itself rather than a separately stored counter — one
    less thing that could drift out of sync. No hard cap on how many
    times it can be bought; the escalating cost is the only limiter.
    `/profile` shows an "Expand den" button computing the same cost
    formula client-side for display (`nextDenExpansionCost` in
    `src/app/profile/page.tsx`, kept in a comment-linked lockstep with
    the SQL) — but the RPC re-derives and enforces the real cost
    server-side regardless of what the client shows or sends.
  - **`admin_grant_self_currency(p_admin_user_id, p_coin_delta, p_gem_delta)`**
    (`/admin/currency`) — a testing tool for granting yourself coins/gems
    without a purchase flow yet, and likely still useful later for
    support/compensation even once one exists. Deliberately scoped to
    the calling admin's **own** account only — there's no target-user
    parameter anywhere in this path, matching the "no in-app way to
    affect any account but mine" rule the rest of the admin panel
    follows. This is also why it's a narrow RPC that only ever touches
    `coin_balance`/`gem_balance` (hardcoded in the function body) rather
    than a general admin `UPDATE` policy on `users` — a blanket policy
    would let an admin's REST client touch `is_admin`/`email`/`den_size`
    on any account too, which would defeat the single-admin guarantee at
    the database level. Deltas can be negative (balances clamp at 0, never
    go negative) and every grant is logged to `admin_audit_log` the same
    as every other admin action, just with a synthetic
    `target_table = 'users.currency'` since it isn't a plain
    trigger-logged table write.
  - Verified locally the same way as every other migration: both
    `psql -f`/`psql -1` apply cleanly, and — role-switched as both an
    admin and non-admin account — a direct client `UPDATE` to
    `coin_balance`/`gem_balance`/`den_size` is still silently reset,
    `expand_den` rejects insufficient coins and rejects being called for
    a different user, `admin_grant_self_currency` rejects non-admins, a
    real grant lands both balances and is audit-logged, and two
    successive `expand_den` calls charge 500 then 750 exactly as the
    cost curve intends.
- **Pets/items split & pet folders (`0012_pet_folders.sql`, `/pets`,
  `/items`)** — `/inventory` (a single page mixing two increasingly
  different systems) is now two pages; the old route just `redirect()`s
  to `/pets` so old links/bookmarks still land somewhere.
  - **Folders are a simple owned table** (`pet_folders`: `owner_id`,
    `name`) with plain owner-scoped RLS CRUD policies — unlike most
    player-facing writes elsewhere in this app, folder create/rename/
    delete don't need a security-definer RPC, since a folder holds
    nothing sensitive or invariant-bearing (just a name), the same
    reasoning that already let `settings/actions.ts` write
    `display_name`/`bio` directly through RLS instead of via an RPC.
  - **Moving a pet between folders is an RPC** (`move_pet_to_folder`),
    not a client `UPDATE` policy on `pets` — `pets` has never had a
    client-facing write policy (species/rarity/etc. must never be
    client-writable; see 0002), and adding a broad "owner can update own
    pets" policy just to allow `folder_id` changes would reopen that.
    The RPC only ever touches `folder_id`, verifies the caller owns both
    the pet and the target folder, and — like several player RPCs
    already in this app — the request just fails outright with an
    exception on ownership mismatch rather than silently no-op'ing,
    since there's no legitimate case where it's called for someone
    else's pet or folder.
  - A pet with `folder_id = null` shows under "Unsorted" — not a real
    folder row, so no folder needs to be auto-created for new users.
    Deleting a folder (`on delete set null` on `pets.folder_id`) drops
    its pets back to Unsorted automatically; nothing else needs to move
    them out first.
  - Verified locally the same way as every other migration: both
    `psql -f`/`psql -1` apply cleanly, and — as two different simulated
    accounts — one user can't see, rename, or delete another's folders,
    can't move another user's pet, and deleting a folder correctly
    clears `folder_id` back to null on its pets rather than cascading
    the delete to the pets themselves.
  - The items page's type tabs (All / Ingredients / Potions / Cosmetics)
    are a plain `?type=` query param read via `props.searchParams` (Next
    16's `PageProps` helper, same `await`-a-Promise shape as `params` —
    see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`)
    filtering the same inventory query the old page already ran — no new
    table or RPC needed for this part.
  - **`/pets` was redesigned again shortly after** to fix a real UX
    problem the first version had: every folder rendered as its own
    always-expanded section stacked on one page, which doesn't scale.
    It's now `?folder=<id|all|unsorted>` + `?page=<n>` driven — folders
    are tabs (`All` / each folder / `Unsorted`, each showing its own
    count), and the active tab is paginated at 25 pets per page via
    `.range()`. Tab counts come from `{count:"exact",head:true}` queries
    (one per folder, run in parallel) rather than fetching every pet's
    row just to count them; the actual pet data query only ever fetches
    the current tab's current page.
- **Pet naming (`0013_pet_names.sql`)** — Chicken Smoothie-style: every
  pet starts unnamed (`custom_name` defaults to null, never backfilled
  from the species name) and stays that way until the owner sets one.
  The species name is never treated as the pet's display name — it's
  shown as smaller secondary/breed-style text under the name slot, which
  itself shows a "+ Name this pet" prompt (not a placeholder title) when
  unnamed, and becomes an inline-editable name once set
  (`pet-name-editor.tsx`).
  - **`rename_pet(p_user_id, p_pet_id, p_name)`** follows the exact same
    shape as `move_pet_to_folder` (0012) and for the same reason: `pets`
    has never had a client `UPDATE` policy, so this is a narrow RPC that
    only ever touches `custom_name` rather than a blanket owner-update
    policy that would also reopen `species_id`/`rarity`/etc. to client
    writes. Blank/whitespace-only input clears the name back to
    null — that's how a player "un-names" a pet — rather than being
    rejected.
  - A `check` constraint on the column itself (null, or 1-40 chars)
    backs up the RPC's own length check — defense in depth, same
    reasoning as the length checks already used elsewhere in this app.
  - Verified locally the same way as every other migration: both
    `psql -f`/`psql -1` apply cleanly; role-switched as two different
    accounts, one user can't rename another's pet, a name gets trimmed
    and saved correctly, blank input clears it back to null, a
    41-character name is rejected, and a direct client `UPDATE` to
    `custom_name` still does nothing (no RLS policy allows it).
- **`game-assets/` drop folder** — a place to hand over real art in
  future turns instead of describing it in chat. See
  [`game-assets/README.md`](./game-assets/README.md) for the convention
  (subfolder by kind, filename loosely matched to the existing
  species/item/zone name) — not itself app code, just a documented
  workflow for getting art into Storage without going through the admin
  UI's file picker one image at a time.
- **Cream/parchment theme + wood-sign header** — a site-wide palette
  swap plus a header redesign, prompted by real art assets dropped into
  `game-assets/` (see that folder's own notes above).
  - **The palette swap is a straight, ordered token substitution**
    across every `.tsx`/`.ts` file under `src/`: every `zinc-*` Tailwind
    class became `amber-*` (backgrounds, borders, primary buttons —
    the "cream/wood" tones) or `stone-*` (secondary/muted text, dark-mode
    surfaces — a warm-toned gray so dark mode stays coherent with the
    new identity rather than reverting to a cold gray). This was safe to
    do as a scripted, ordered find-and-replace (longest/most-specific
    class first — e.g. `dark:hover:bg-zinc-900` before `dark:bg-zinc-900`
    before `bg-zinc-900` — so a shorter pattern never corrupts a longer
    one it's a substring of) specifically because this codebase only
    ever used Tailwind's palette classes directly, in a small, consistent
    vocabulary I'd authored myself — there was no semantic token layer to
    preserve. `bg-black/NN` modal scrims and plain `bg-white` cards were
    deliberately left alone (a scrim doesn't need to match the theme, and
    a white card reads fine as "paper" against the new cream page
    background).
  - **`globals.css`'s `--background`/`--foreground` CSS variables were
    updated to match**, not just the `bg-amber-50` class on `<body>` —
    that plain `body { background: var(--background) }` rule is
    unlayered CSS, which wins the cascade over a Tailwind utility class
    regardless of specificity, so leaving the variables at their old
    white/black values would have silently overridden the new class.
  - **The header** (`site-header.tsx`) was redesigned around the
    Animal Jam-style reference the assets came with: a warm-brown
    plank-toned bar, a pill-shaped nav strip, and a distinct rounded
    cream "signpost" panel on the right for the account area — now also
    showing the coin/gem balance at a glance, reusing data the header's
    profile query already needed to fetch. This approximates the
    reference's *structure and palette*, not a literal recreation of its
    hand-painted wood/rope/forest illustration — no assets for that
    specific art were provided, and faking a wood texture with CSS
    gradients alone tends to look worse than a clean, deliberately
    simpler shape in the same palette.
  - **Real icon art replaced emoji/placeholder shapes in a few spots**:
    the brewing stand's recipe-book button and its 3 ingredient slots
    (now the actual item-slot frame art, swapping empty/filled states
    instead of a dashed border), the recipe book modal itself (now
    rendered over the open-book illustration instead of a plain white
    card), and a small edit-pencil icon next to the pet name/folder
    rename controls. These specific spots were picked because they're
    exactly what the dropped assets were for (book backdrop, inventory
    slots, icons per the request) — not every emoji or plain-text
    "Rename"/error message in the app was swept in this pass, to keep
    the change reviewable.
  - Chrome/UI assets (icons, panel art, the book backdrop) live in
    `public/icons/` and `public/ui/`, served directly — **not** uploaded
    to the Supabase Storage bucket from 0010. That bucket is for
    admin-editable game content (pet/item/zone art a database row points
    to via `image_url`); these are static, code-shipped assets that ship
    with a deploy like any other file in `public/`, with no admin upload
    step or database row involved.
  - Verified visually, not just via typecheck/build/lint (this is a
    styling change — those wouldn't catch a broken layout): ran the dev
    server against a stub Supabase URL and drove headless Chromium
    (Playwright, this environment's pre-installed browser) to screenshot
    both the logged-out `/` and `/login` pages for real, and a temporary
    throwaway route for the logged-in header state (deleted before
    finishing, along with the stub `.env.local` — neither was committed).
  - **Follow-up fix**: that first verification pass used Playwright's
    default color scheme (light), which is exactly why it missed a real
    bug — Tailwind v4 defaults `dark:` to `@media (prefers-color-scheme:
    dark)`, and `globals.css` had its own separate `@media
    (prefers-color-scheme: dark)` block setting `--background` back to
    near-black. Anyone with their OS/browser in dark mode saw a black
    site regardless of the new theme. Since cream is meant to be *the*
    theme for now, not one half of a light/dark toggle, the fix switches
    Tailwind to class-based dark mode (`@custom-variant dark
    (&:where(.dark, .dark *));`) and drops the CSS media-query override
    — `dark:*` classes and dark-mode colors now only ever apply if
    something adds a `dark` class to `<html>`, which nothing does yet.
    All the `dark:` work already in the codebase stays intact and ready,
    just dormant. Re-verified by re-running the same Playwright check
    with the browser's color scheme explicitly forced to `dark` this
    time — confirms the page stays cream regardless of system
    preference.
  - **Recipe book, redesigned again**: the open-book illustration
    (`book-container.png`) as a fixed-aspect-ratio backdrop with content
    absolutely positioned over it looked bad and clipped — an open
    book's curved page/spine art doesn't leave a clean, predictable
    rectangle to lay arbitrary content inside, and a scrolling list
    could overflow past where the illustration's edges implied and
    visibly clip. Replaced with `parchment-panel.png` (an actual
    rectangle with a dashed border baked into the art) set as a
    `background-size: 100% 100%` background on a normally-flowing
    container — the image stretches to fit whatever height the content
    needs instead of content being constrained to fit the image, and a
    flat rectangle stretches cleanly where a spined book illustration
    wouldn't. Paired with pagination (`RECIPES_PER_PAGE = 3`, plain
    `useState` page index, Previous/Next buttons) instead of scrolling,
    per feedback — a "page" is always a small, predictable amount of
    content, so there's nothing to overflow. Each recipe now shows
    visually as its ingredients (icon + a `×N` quantity badge per
    distinct ingredient) → an arrow → the output potion, with the
    potion's effect (`describeEffect()`) in a CSS-only hover tooltip
    (`group`/`group-hover`, no JS state) instead of buried in a text
    line. Verified the same way — drove headless Chromium to open the
    book, page forward, and hover a potion, screenshotting each step —
    using a temporary preview route with mocked recipe data (deleted
    before finishing) since exercising this needs real inventory data
    this sandbox doesn't have a live Supabase project for.
