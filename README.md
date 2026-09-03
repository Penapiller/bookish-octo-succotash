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
      few spots. **Superseded by the wireframe page layout below** — the
      site-wide chrome (header/nav/footer/background) moved away from
      the amber gradient bar; individual page content (buttons, cards,
      etc.) still uses the amber accent palette described here. See
      Notes below for exactly what did and didn't change
- [x] Wireframe page layout — every page now renders inside a shared
      shell: a logo box (top-left, links home) and a user-info box
      (top-right) in the header, a grouped/foldable nav bar underneath,
      the actual page content in a centered white content box, and a
      footer bar — all wired once in the root layout, not per-page. The
      page background is a simple placeholder pattern for now, swappable
      for a real image later. See Notes below
- [x] Unique, rate-limited usernames — `display_name` is now a unique
      handle (case-insensitive) rather than a free-form label: no two
      accounts can share one, and changing it costs 15 gems and can only
      be done once every 14 days. See Notes below
- [ ] Statue offerings
- [~] Trading — **built, tested, but currently disabled** behind
      `TRADING_ENABLED` in `src/lib/feature-flags.ts` (set to `false`) —
      superseded by the Marketplace below per a later change of
      direction, kept intact rather than deleted in case it comes back.
      No nav link, no entry points anywhere, and every `/trades/*` route
      404s while disabled. See Notes below for what it was
- [x] Marketplace — Flight-Rising-style fixed-price listings (not a
      timed-bid auction): list a pet or a stack of items, anyone can buy
      instantly at the listed price. A listing can be priced in coins,
      gems, or both at once — the buyer picks whichever they'd rather
      pay with — and the seller chooses how long it runs (1/3/7/14/30
      days); it automatically unlists itself if nobody buys in time.
      `/marketplace` (browse, filterable by name/rarity/price),
      `/marketplace/sell` (list something via the same searchable picker
      trading used), `/marketplace/mine` (your active/sold/cancelled/
      expired listings and purchase history). See Notes below
- [ ] Profile customization (sanitized custom CSS/HTML)
- [x] Forums — admin-managed categories (and one level of subcategories,
      each with an optional icon), threads, and posts, styled after a
      classic phpBB/Chicken-Smoothie-style forum: a Quick Jump sidebar,
      a Forum Index panel, pinned/regular topic lists with view and
      reply counts, and paginated thread views. Players write posts with
      a BBCode editor — a toolbar (bold/italic/underline/strike, quote,
      horizontal rule, alignment, font size, font color) that inserts
      tags into a plain textarea, so typing tags by hand works exactly
      the same as clicking a button. **Superseded the original WYSIWYG-
      or-raw-HTML editor** (TipTap + an HTML sanitizer) — see Notes below
      for why the BBCode approach replaced it and how it's now the
      security boundary instead. No video/audio/iframe embeds exist as a
      BBCode tag at all (links to them are still fine)

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
  - **Recipe book, redesigned twice**: round one used the open-book
    illustration (`book-container.png`) as a fixed-aspect-ratio backdrop
    with content absolutely positioned over it — looked bad and clipped,
    since an open book's curved page/spine art doesn't leave a clean,
    predictable rectangle for arbitrary (and scrolling) content to sit
    inside without overflowing past where the art implied its edges
    were. Round two swapped it for `parchment-panel.png` (a plain
    rectangle) plus pagination instead of scrolling — fixed the clipping,
    but dropped the actual book art the user wanted, and looked plain.
    Round three (the current design) keeps `book-container.png`, but
    instead of one large content area, lays out two small,
    precisely-bounded content boxes — one per page-half — positioned via
    percentage insets calibrated directly against the artwork (a Python
    script drew gridlines at candidate percentages onto the image so the
    safe cream area, clear of the spine and curved top/bottom edges,
    could be read off exactly: each page's content box is
    `left/right: 10%/55%, width: 35%, top: 12%, height: 74%`). Each page
    holds exactly 3 fixed-size recipe cells (`RECIPES_PER_SIDE = 3`, 6
    per two-page spread) rather than a variable-length list, so there's
    a hard upper bound on content per page and nothing can ever overflow
    the calibrated box — pagination (plain `useState` page index,
    Previous/Next buttons) flips between spreads of 6. Each cell is
    itself a button showing the recipe's ingredients (icon + a `×N`
    badge when quantity > 1) → an arrow → the output potion, clicking it
    fills the brewing slots (replacing the old separate "Fill slots"
    button, since cell space is tight), and hovering the potion shows
    its effect (`describeEffect()`) in a CSS-only tooltip
    (`group`/`group-hover`, no JS state).
  - Verified the same way both times — drove headless Chromium to open
    the book, page forward, and hover a potion, screenshotting each
    step, using a temporary preview route with mocked recipe data
    (deleted before finishing) since exercising this needs real
    inventory data this sandbox doesn't have a live Supabase project
    for. For round three, used same-origin local image files as the
    mock recipes' art (rather than an external placeholder host) so the
    screenshots showed real rendered images instead of broken-image
    icons — this sandbox's network policy blocks the external host used
    in earlier rounds' mocks, which isn't a real app issue (real art
    loads from Supabase Storage) but did mean earlier verification
    screenshots showed broken images where the layout mattered more than
    the pixels.
- **Recipe book: larger fixed-size icons, page-turn arrows, page numbers**
  — three follow-up refinements once the two-page-spread layout (above)
  was in place and felt too small.
  - Each image slot in a `RecipeCell` (every ingredient + the output
    potion) first tried `flex-1` width + `h-full` so a full recipe's 4
    slots (3 ingredients + potion) would fill the row edge-to-edge — but
    that meant recipes with *fewer* ingredients got *larger* slots than
    ones with more, since fewer flex items divide the same row width
    between them. That's not what was wanted: every icon should read as
    the same size everywhere in the book, and a short recipe should just
    leave empty space rather than growing to fill it. Reverted to fixed
    pixel sizing (`CELL_ICON_SIZE = 52`, `CELL_POTION_SIZE = 64` — a
    modest bump over the original 44px/56px) via `<Image>` `width`/
    `height` plus matching inline `style`, with `shrink-0` wrapper divs
    instead of `flex-1`. A recipe with fewer ingredients now just
    produces a shorter, left-aligned row at the same icon size as every
    other row.
  - Page-turn arrows (`PageArrowButton`) replaced the old Previous/Next
    text buttons below the book — they now sit directly beside it,
    using art the user dropped into `game-assets/` (a plain "brown
    outline" arrow for rest state and a bolder "double outline" variant
    for hover). The hover swap is two stacked `fill` images with a CSS
    opacity crossfade on `group`/`group-hover` — no JS state — and the
    disabled (first/last page) state just dims the button and skips
    rendering the hover image entirely, so a disabled arrow can't
    visually swap on hover.
  - Page numbers are printed directly on the page art (bottom-center of
    each half, inside the same calibrated safe zone as the recipe
    cells) rather than only in a caption below the book — left page
    always odd, right always even, counting up across spreads
    (`page * 2 + 1` / `page * 2 + 2`), matching how a real book numbers
    its pages.
  - Verified the same way as the rest of this feature: headless Chromium
    against a temporary preview route with mocked recipes deliberately
    covering the 4-image, 3-image, and 2-image cases, confirming every
    icon renders at the same fixed size regardless of ingredient count,
    the hover crossfade fires, the correct arrow dims at each end of the
    page range, and the printed page numbers advance correctly across a
    spread turn.
- **Unique, rate-limited usernames (`0014_unique_display_names.sql`)** —
  `display_name` (previously free-form, unconstrained, changeable anytime
  via a plain client `.update()`) is now the player's unique handle.
  - **Uniqueness is case-insensitive**: a `unique index` on
    `lower(display_name)`, so "Bob" and "bob" can't both exist. Any
    pre-existing duplicates (this column had no constraint before) are
    resolved by the migration itself before the index is created —
    grouped by lowercased name, the earliest-created row in each group
    keeps its name, every later one gets a numeric suffix appended
    (`-2`, `-3`, ...) until it's free.
  - **The rule is uniform, no free first customization window**: every
    change — including a brand-new account's very first change away from
    its auto-assigned signup name — costs 15 gems and can only happen
    once every 14 days. `display_name_changed_at` is backfilled to
    `created_at` for existing rows and set at signup for new ones, so the
    14-day clock always starts at account creation.
  - `change_display_name(p_user_id, p_new_name)` is the only way to
    change it: re-validates `auth.uid()`, trims/collapses whitespace,
    enforces a 3–40 character length, checks the 14-day cooldown against
    `display_name_changed_at`, checks the caller has ≥15 gems, checks the
    trimmed name isn't already taken (case-insensitively, excluding the
    caller's own row), then spends the gems and updates both columns in
    one `security definer` transaction. Returns the new name, new gem
    balance, and `next_change_available_at` so the UI doesn't need a
    second round-trip to know when the cooldown clears.
  - `display_name` and `display_name_changed_at` were added to
    `protect_privileged_user_fields`'s guarded-column list (same pattern
    as `coin_balance`/`gem_balance`/`den_size` since 0001/0011) —
    otherwise a plain client `.update()` on `users` could change the name
    directly and skip every check above. `src/app/settings/actions.ts`'s
    `updateProfile` now only ever touches `bio`.
  - `handle_new_user()` (the Google-sign-in trigger from 0001) was
    redefined to sanitize the candidate name from Google's `full_name`
    (collapsing whitespace, capping length) and append a numeric suffix
    if it collides with an existing name, looping until unique — the same
    logic as the backfill above — so two people who happen to share a
    real name never fail to sign up.
  - New client component `src/app/settings/display-name-editor.tsx`
    (same edit/save/cancel shape as `PetNameEditor`) calls
    `change_display_name` directly via `supabase.rpc(...)`, shows the
    gem cost on the button, and — when the cooldown hasn't elapsed —
    replaces the button with "You can change your name again on
    &lt;date&gt;" instead of showing a control that would just error.
  - Verified at the database level (both `psql -f` and `psql -1` against
    a local Postgres 16 instance stubbed with a minimal `auth.users` /
    `auth.uid()` / `auth.role()` / `storage.buckets`, since this is real
    Supabase platform schema this app's migrations depend on but a bare
    Postgres install doesn't have): role-switched as an authenticated
    user through every guard (cooldown not yet elapsed, wrong user,
    name-already-taken, too-short, not-enough-gems, then a real
    success), confirmed the cooldown re-arms immediately after a
    successful change, confirmed a plain `UPDATE` from an authenticated
    role is silently reverted by the trigger while the same `UPDATE` as
    `service_role` (the Supabase SQL Editor / an admin script) goes
    through, and confirmed both the signup-time and migration-time
    dedup logic against manufactured duplicate names. UI states (can
    change now, on cooldown, insufficient gems, the open edit form) were
    checked visually with headless Chromium against a temporary preview
    route.
- **Trading (`0015_trading.sql`, `/trades`)** — a fixed offer, not a live
  negotiation thread. The initiator picks pets/items/coins/gems from
  their OWN den/inventory to offer, addressed to a recipient by their
  unique username (resolved client-side to a user id via `user_profiles`
  before calling `create_trade`), plus an optional free-text note saying
  what they'd like back. The recipient never sees or picks FROM the
  initiator's collection and vice versa — neither player can browse the
  other's private den/inventory (no new RLS was opened up for that), so
  the only thing either side ever offers is drawn from their own
  `pets`/`user_inventory`. Accepting means building your own counter
  from your own collection (or nothing, to accept as a pure gift) and
  submitting it — that submission executes the swap immediately, there's
  no further back-and-forth round in this first version.
  - **Not an escrow system, by design**: `create_trade` only sanity-checks
    ownership/balance at proposal time — it doesn't lock or reserve
    anything. The same pet could be offered in two different trades, or
    spent before either resolves. `respond_to_trade` re-validates
    everything from scratch (ownership, item quantities, coin/gem
    balances, for both sides) inside the same transaction that executes
    the swap, and aborts cleanly with "This trade is no longer valid —
    the offer has changed" if anything moved in the meantime — verified
    directly by manufacturing a stale offer (moving the offered pet away
    via a separate service-role update between `create_trade` and
    `respond_to_trade`) and confirming the accept fails and the trade
    stays `pending`, untouched.
  - Three tables: `trades` (one row per proposal — status, note, and
    each side's coin/gem amounts), `trade_pets` and `trade_items` (which
    pets/items are on which `side`). `side` is stored explicitly rather
    than derived from `pets.owner_id` — that column changes the moment a
    trade completes, so deriving "who offered this" from current
    ownership would break a trade's own history the instant it finished.
  - Three RPCs, same `security definer` + re-validate-`auth.uid()`
    pattern as every other write path in this app: `create_trade`
    (propose), `respond_to_trade` (decline, or accept with a
    counter-offer — one call handles both, `p_accept` switches the
    branch), `cancel_trade` (initiator only, only while still
    `pending`). The swap itself — pet ownership transfer, inventory
    quantity moves both directions, currency moves both directions — all
    happens inside `respond_to_trade`, in the same transaction as the
    re-validation, so a failed check can't leave a half-executed trade.
    Currency updates go through `begin_trusted_user_write()` first, same
    as every other function that touches `coin_balance`/`gem_balance`.
  - Both accounts are locked (`for update`) in a consistent order — by
    `id`, not by role — before either balance is touched, so two trades
    between the same pair of players can never deadlock against each
    other.
  - **A real RLS gap caught before it shipped**: `pets` has only ever
    let an owner see their own pets (0002). That's fine for everyday use
    but breaks trading in two ways — a recipient reviewing a pending
    offer needs to see the initiator's offered pet despite never owning
    it, and once a trade completes, whoever gave a pet away no longer
    owns it but should still see it in their own trade history. Added an
    additional (additive — RLS `SELECT` policies are OR'd together)
    policy: any pet named in `trade_pets` is visible to either
    participant of that trade, regardless of current ownership or trade
    status. Verified directly: after the swap, role-switched as each
    former owner and confirmed both could still see the pet they gave
    away, then role-switched as a third, uninvolved account and
    confirmed it saw neither — this policy widens visibility only for
    pets that passed through a trade the caller was actually part of,
    never a stranger's den.
  - New client-side local Postgres stub needed for this migration's
    testing: `authenticated`/`anon` roles with real table grants (a real
    Supabase project grants these by default and lets RLS do the actual
    enforcement; a bare local Postgres install has neither the roles nor
    the grants, so `SET ROLE authenticated` failed with a plain
    "permission denied" before RLS was ever consulted, independent of
    any policy). Fixed with `ALTER DEFAULT PRIVILEGES ... GRANT SELECT,
    INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated` in the stub,
    applied before any migration creates a table.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    role-switched as two + a third uninvolved account through every
    guard on both `create_trade` and `respond_to_trade` (self-trade,
    recipient not found, empty offer, offering a pet/item/currency
    amount you don't have, a non-participant or the wrong side trying to
    respond, responding to an already-resolved trade, countering with a
    pet you don't own), then a full successful trade — confirming pets
    swapped owners with `folder_id` reset, coins/gems moved by exactly
    the right amount on both sides, and item quantities moved on both
    sides — then the decline path, the cancel path (including an
    unauthorized cancel attempt), and the stale-offer re-validation case
    above. UI states (the trade builder, trade cards in different
    statuses, the respond form, pet selection toggling, item quantity
    inputs) were checked visually with headless Chromium against a
    temporary preview route mounting the client components directly with
    mock data, since exercising the real pages end-to-end would need a
    live Supabase project this sandbox doesn't have.
  - Original page layout (superseded by the Trading Center redesign
    directly below): a single `/trades` inbox page with incoming/
    outgoing/history sections, and a builder that only ever took a
    free-text "what I want" note since neither side could see into the
    other's collection.
- **Trading Center redesign, for-trade browsing, and the trade picker
  modal (`0016_for_trade_flags.sql`, `0017_trade_requests.sql`)** — three
  follow-ups after using the first version of trading, modeled on how
  Chicken Smoothie's trading actually works: players mark specific
  pets/items available to trade, anyone can browse and search that pool,
  and proposing a trade means picking concretely from it rather than
  hoping a free-text note gets read.
  - **`is_for_trade`** (`0016`) is a plain boolean on `pets` and
    `user_inventory`, toggled by the owner via `set_pet_for_trade`/
    `set_item_for_trade` (both the same narrow-RPC-per-mutation pattern
    as `rename_pet`/`move_pet_to_folder`, since neither table has ever
    had a client `UPDATE` policy) plus a bulk `set_folder_pets_for_trade`
    for tagging a whole folder ("pet group") at once — the "mark all in
    this group for trade" button on `/pets`. **It only gates discovery,
    never what can actually be offered**: once two players are already
    building a trade, either side can still offer anything they own,
    flagged or not — see `create_trade`'s comment for why (nothing here
    is a reservation, only a visibility rule).
  - **Browse visibility**: two new additive `SELECT` policies (`pets`,
    `user_inventory`) let any signed-in player see a for-trade pet/item
    regardless of who owns it — the first time either table has ever
    been visible beyond its owner. `/trades/browse` is the Trading-Post-
    style page this enables: tabs for pets/items, filterable by name/
    rarity/owner username, paginated, each result linking to
    `/trades/new` pre-targeted at that owner and that specific pet/item.
  - **The initiator can now request specific things from the recipient's
    side too** (`0017` extends `create_trade` with five trailing
    defaulted params — the one signature change `CREATE OR REPLACE`
    allows without dropping the function — so old callers still work
    unchanged), validated against what the recipient has actually
    marked `is_for_trade` and inserted as `side = 'recipient'` rows at
    proposal time, same sanity-check-now/re-verify-at-accept-time
    caveat as everything else on this table. This is a *request*, not a
    lock: the recipient's response form pre-fills from it but can freely
    swap in something else before accepting.
  - **A real bug this surfaced**: `respond_to_trade` previously always
    `INSERT`ed the recipient's submitted pets/items, which worked when
    the recipient side started empty — but now `create_trade` may have
    already inserted `side = 'recipient'` rows as the request, and
    re-confirming (or partially reusing) the same pet/item id would hit
    `trade_pets`/`trade_items`'s primary key. Fixed by having
    `respond_to_trade` `DELETE` any existing `side = 'recipient'` rows
    before inserting whatever the recipient actually chose to give —
    verified directly by having a recipient swap in a completely
    different pet and a different currency amount than what was
    requested, and confirming exactly one row lands (no duplicate/
    leftover) and the trade's final `recipient_coins` reflects what was
    actually given, not the original ask.
  - Newly-received pets also get `is_for_trade` reset to `false` on
    both sides of a completed swap — a pet doesn't stay publicly
    browsable under its new owner just because its previous owner had
    flagged it.
  - **The shared picker modal** (`src/app/trades/picker-modal.tsx`,
    `PetPickerModal`/`ItemPickerModal`) is what "search and filter
    through their and their partner's items/pets" turned into: a name
    search box + rarity dropdown over a normalized `PickerPet`/
    `PickerItem` shape, so the same component renders a player's own
    collection (already loaded server-side) or another player's
    for-trade pool (fetched client-side once a recipient is resolved,
    since only then is their user id known) identically. Used in three
    places: the trade builder's "You give" (own collection, unfiltered
    by `is_for_trade` — see above) and "You want" (recipient's
    for-trade pool only) columns, and the respond form's own-collection
    picker.
  - **A real bug this surfaced, caught by the Playwright pass, not the
    type checker**: the trade builder's "You give" chips initially read
    straight from the raw `PetWithSpecies[]`/`ItemWithQuantity[]` props
    (which don't have a top-level `.name`/`.imageUrl`) instead of the
    normalized picker shape used everywhere else — the `as PickerPet[]`
    cast silenced TypeScript, so it built and typechecked cleanly, but
    every added-pet chip rendered as an empty circle with no name or
    image. Fixed by normalizing once (`toPickerPets`/`toPickerItems`)
    and reusing that everywhere instead of passing the raw query result
    into a component that expects the normalized shape.
  - `/trades` is now the **Trading Center** hub — pending-trade counts,
    quick links, and a short recent-activity list — with the actual
    trade lists split out: `/trades/active` (incoming/outgoing pending),
    `/trades/history` (resolved), `/trades/browse` (the for-trade
    marketplace above), `/trades/new` (the builder), `/trades/[id]`
    (detail — unchanged in structure, just relabels the recipient side
    "What they're asking you for" / "What you're asking ... for" while
    `pending`, versus "gave" once resolved, since that side may now be a
    live request rather than a settled fact).
  - Verified the same way as the original trading feature: local
    Postgres 16 (both `psql -f` and `psql -1`) for the schema/RPC
    changes — role-switched through the for-trade toggle ownership
    check, confirmed a stranger can see only the specific pets/items an
    owner marked for trade (not the rest of their den), a full
    create-request-then-accept-as-is trade, and the swap-in-something-
    different case that caught the delete-before-insert bug above — then
    headless Chromium against a temporary preview route mounting the
    real trade builder and respond form components with mock data
    (search/filter inside the picker modal, adding/removing pets and
    items, the pre-filled request chips), since exercising the real
    pages end-to-end would need a live Supabase project this sandbox
    doesn't have.
- **Trading disabled, Marketplace added instead
  (`src/lib/feature-flags.ts`, `0018_marketplace.sql`)** — after using
  the redesigned trading feature above, decided to hold off on
  player-to-player trading for now and build a currency marketplace
  instead, referencing how Flight Rising's Marketplace works (their
  fixed-price listings, not their timed-bid Auction House).
  - **Trading was disabled, not deleted.** `TRADING_ENABLED` in
    `src/lib/feature-flags.ts` is the single switch: every trading nav
    link, the "Propose a trade" button on `/u/[id]`, and the for-trade
    toggles on `/pets`/`/items` are conditional on it, and every
    `/trades/*` page calls `notFound()` at the top when it's off — so
    direct navigation to a trading URL 404s the same for a player as
    for an admin (there's no trading-specific admin UI to separately
    hide). Flipping the flag back to `true` is the entire re-enable;
    nothing else changes. The underlying RPCs
    (`create_trade`/`respond_to_trade`/etc.) still exist and would still
    work if called directly — same as any other RPC in this app, they
    require real auth and real ownership — but with every UI entry
    point gone, nothing in the app ever calls them.
  - **Fixed-price, not an auction**: a seller lists a pet or a stack of
    items at a coin price; any other player buys the whole listing
    instantly for that price. No bidding, no timers, no partial
    purchases (a seller who wants to sell some of a stack now and some
    later just lists twice) — deliberately the simpler of Flight
    Rising's two systems, chosen over timed bidding to avoid needing a
    bid-resolution job, outbid refunds, and anti-snipe extensions for a
    first version. Coins only, matching the rest of the economy — gems
    still have no earn path outside admin testing grants, so nothing to
    spend them on here either.
  - **Pet listings snapshot their display info at listing time**
    (`pet_species_name`/`pet_species_image_url`/`pet_rarity`/
    `pet_custom_name` columns on the listing itself) instead of joining
    the live `pets` row. `pets` has been owner-gated since 0002, and
    trading's fix for the same problem (0015) was to add another
    permissive `SELECT` policy scoped to trade participants — doing
    that again here would mean every future feature that needs to show
    someone else's pet adds its own carve-out. Denormalizing instead
    means a listing is fully self-contained for display and needs zero
    new policies on `pets`; item listings didn't need this treatment
    since the item catalog (`items`, not any one player's stack of it)
    has been publicly readable since 0005.
  - **A real bug caught by the local Postgres verification, not by
    reasoning about the code**: `buy_listing`'s stale-listing path
    tried to `UPDATE ... SET status = 'cancelled'` and then
    `RAISE EXCEPTION` in the same breath, intending "clean up the dead
    listing, then tell the buyer why." A raised exception in `plpgsql`
    aborts the *whole function call* and rolls back everything since
    entry — including that same cancellation update — so the listing
    was silently left `active` instead, forever failing the same way
    for the next buyer too. plpgsql has no way to make one write outlive
    an exception without a genuinely separate (autonomous) transaction,
    which isn't worth reaching for here. Fixed by not raising for this
    specific case: the function returns normally with
    `{"status": "unavailable", "reason": "..."}` instead, the same
    non-exception-status pattern `respond_to_trade` already uses for
    "declined" (0015) — so the cancellation commits, and the client
    checks the returned `status` rather than only `error`. Verified by
    re-running the exact repro (list a pet, give it away via a separate
    service-role update before purchase, then attempt to buy) and
    confirming the listing now actually flips to `cancelled`.
  - Every other write path follows the same conventions as trading and
    everything before it: `security definer` RPCs re-validating
    `auth.uid()`, `for update` row locks (both accounts locked in a
    consistent order by id, so two purchases between the same pair of
    players can't deadlock), `begin_trusted_user_write()` before
    touching `coin_balance`, and sanity-check-at-listing/re-verify-at-
    purchase rather than a reservation system (the same caveat as
    trading's offers — a listed pet or item quantity isn't locked, just
    checked again for real when someone actually buys).
  - The shared pet/item picker modal moved from `src/app/trades/` to
    `src/components/picker-modal.tsx` so the marketplace's sell flow
    could reuse it without depending on a folder that's now hidden
    behind a feature flag — trading's own usages were repointed at the
    new location, nothing about the component itself changed.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    listing ownership checks for both pets and items, listing an
    already-actively-listed pet again, listing more items than owned,
    a buyer with insufficient coins, buying your own listing, buying an
    already-sold or cancelled listing, the cancel-your-own-listing path
    (including an unauthorized attempt), a full successful pet purchase
    (owner transferred, `folder_id`/`is_for_trade` reset, coins moved
    both directions), a full item purchase (quantities moved both
    directions), and the stale-listing case above. UI states (listing
    cards in different statuses, the buy confirm/cancel flow, the sell
    form's pet/item picker) were checked visually with headless
    Chromium against a temporary preview route mounting the client
    components with mock data.
- **Listing duration/auto-expiry and gem pricing
  (`0019_marketplace_upgrades.sql`)** — three requests after using the
  marketplace above: let the seller choose how long a listing runs
  (auto-unlisting itself when time's up), let a listing be priced in
  gems as well as coins, and let it offer both at once so the buyer
  picks.
  - **No cron job** — `expires_at` (set at creation from the seller's
    chosen duration: 1/3/7/14/30 days, validated server-side against
    that exact list) is enforced the same lazily-on-page-load way as
    `resolve_due_expeditions`/`resolve_due_brews`, via a new
    `resolve_expired_listings()` called at the top of `/marketplace` and
    `/marketplace/mine`. The one difference from those two: it isn't
    scoped to a single player (`resolve_due_expeditions(p_user_id)` only
    resolves that caller's own due expeditions) — browsing the
    marketplace needs *everyone's* expired listings cleared, not just
    the viewer's own, and since the function only ever flips a
    listing's own status field, there's no risk in any signed-in player
    being the one who happens to trigger the sweep. `buy_listing` also
    re-checks `expires_at` directly (same non-exception-`status`
    pattern as the stale-pet/stale-item checks it already had), so a
    listing that expired in the moments before the lazy sweep last ran
    still can't be bought.
  - **Hit the exact `ALTER TYPE ... ADD VALUE` gotcha this project
    already documented once** (see the note on
    `0008_potion_effects_and_brew_timers.sql` above): adding `'expired'`
    to `listing_status` and having anything in the *same transaction*
    actually use that value (not just reference it inside a function
    body) fails. Nothing in this migration does that, but added the same
    explicit `commit;` right after the `ALTER TYPE` anyway, matching
    0008's fix exactly rather than relying on the distinction between
    "referenced in a function body" and "used as data" holding up under
    `psql -1`'s single-transaction wrapping — cheap insurance, verified
    both ways regardless.
  - **`price_coins` went from required to nullable, and a new nullable
    `price_gems` joined it** — a listing now needs at least one of the
    two set (`check (price_coins is not null or price_gems is not
    null)`), and `buy_listing` gained a `p_currency: 'coins' | 'gems'`
    parameter (a real enum, `listing_currency`) so the buyer states
    which price they're paying — validated against whichever of the two
    the listing actually offers, then debits/credits that specific
    balance. `create_pet_listing`/`create_item_listing` and
    `buy_listing` were dropped and recreated rather than
    `CREATE OR REPLACE`d: unlike 0017's extension of `create_trade`
    (which only ever appended new *trailing, defaulted* parameters),
    here `price_coins` itself changes from required to optional and
    `buy_listing` gains a parameter in the *middle* of its effective
    call shape — different enough from a pure append that a clean
    drop-and-recreate was clearer than working out whether
    `CREATE OR REPLACE` would actually accept it.
  - The sell form now has a duration `<select>` (1/3/7/14/30 days) and
    two price inputs (coins, gems) instead of one, with copy explaining
    a buyer can pay with either. The buy button renders one "Buy — 🪙 N"
    and/or one "Buy — 💎 N" button per price the listing actually offers
    (each independently affordability-gated against the viewer's own
    coin/gem balance), instead of always assuming coins. Listing cards
    show both prices when set (`🪙 75 or 💎 8`) and, while a listing is
    still `active`, a rough time-left label (`Expires in 6d` / `5h`);
    `expired` got its own (visually same as `cancelled`) status badge.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    invalid duration rejected, a listing with neither price set
    rejected, a dual-priced listing bought with gems, a gems-only
    listing correctly rejected when paid with coins, insufficient
    balance checked independently per currency, `buy_listing` returning
    the non-exception `unavailable` result and actually flipping an
    expired listing's status (this was the regression check —
    confirmed the listing does NOT silently stay `active` forever, the
    same class of bug the original stale-pet/stale-item handling in
    0018 had already fixed once for a different trigger), and
    `resolve_expired_listings()` sweeping a force-expired listing while
    leaving an unexpired one untouched. UI states (dual-price and
    gems-only cards, an already-expired card, the two-currency buy
    button, the filled-in sell form) were checked visually with headless
    Chromium against a temporary preview route.
- **Two real bugs from live use: item listings needed real escrow, and
  the price filter was silently broken
  (`0020_marketplace_item_escrow.sql`, `src/app/marketplace/page.tsx`)**
  — both reported after actually using the marketplace above.
  - **Item listings didn't reserve anything.** `create_item_listing`
    only ever checked the seller's *live* inventory count at the moment
    of listing — nothing decremented it — so the same single item
    could be listed several times over (each listing call saw the same
    unchanged quantity and happily said yes), and an item sitting in an
    "active" listing could still be spent elsewhere (e.g. brewing) right
    up until someone actually bought it. Fixed by having
    `create_item_listing` actually escrow: decrement the seller's
    `user_inventory` by the listed quantity immediately, the same
    instant the listing goes live. That single change fixes both
    symptoms at once — a second listing attempt now sees the reduced,
    real remaining quantity and correctly fails "you don't have that
    many to list," and brewing (or anything else that reads live
    inventory) correctly sees the item is gone. `cancel_listing`,
    `resolve_expired_listings`, and `buy_listing`'s own inline expiry
    check all credit the escrowed quantity back to the seller when a
    listing ends without a sale; `buy_listing`'s successful-purchase
    path no longer decrements the seller a second time (that would have
    doubly removed it) — it just credits the buyer directly, and the
    "does the seller still have enough" re-check that item listings used
    to need is gone entirely, since escrow guarantees it by
    construction. Pets were never affected by this bug and needed no
    change — a specific `pet_id` can only ever sit in one active listing
    (already enforced), so the "same item listed several times"
    failure mode has no pet equivalent.
  - **Backfill for listings that already existed under the old,
    non-escrowing behavior**: for every currently-`active` item
    listing, escrow it for real now if the seller still has enough
    (the common case), or — for a listing that can no longer be
    honored because the seller already spent it elsewhere while it sat
    "active" (the exact bug just described) — cancel it outright rather
    than inventing inventory that doesn't exist. Verified by literally
    reproducing the reported repro: listed a single item three times
    over on the pre-fix functions (all three succeeded, exactly as
    reported), then applied this migration and confirmed the backfill
    kept exactly one of the three listings active (escrowing the one
    real unit) and cancelled the other two, with the seller's inventory
    landing at zero — matching what should have happened the whole
    time.
  - **The price filter bug**: the browse page built its min/max price
    filter as two separate `.or(...)` calls (one for min, one for max),
    added when gem pricing made "either currency in range" necessary.
    PostgREST doesn't merge two query parameters that share the same
    key — `.or()` chained twice produces two `or=` params, and only one
    of them ends up taking effect, so setting both a min and a max
    silently dropped one of the two. Confirmed directly (no live
    Supabase project needed for this one — `@supabase/supabase-js`'s
    query builder is pure client-side URL construction, so the bug is
    visible just by building the query and inspecting `.url` before
    it's ever sent) and fixed by combining both bounds into a single
    `.or()` call, nesting `and()`/`or()` for the both-set case:
    `or=(and(price_coins.gte.MIN,price_coins.lte.MAX),and(price_gems.gte.MIN,price_gems.lte.MAX))`
    — "coins in range, or gems in range" as one filter instead of two
    competing ones. Re-verified the same way (inspecting the built URL)
    for all three cases — min only, max only, both — confirming exactly
    one `or=` param each time.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    the full escrow lifecycle (list decrements immediately, listing
    more than what's left over several listings fails, cancel credits
    back, a real purchase credits the buyer without touching the
    seller's already-decremented balance a second time, both expiry
    paths — the lazy sweep and `buy_listing`'s own inline check — credit
    back correctly), plus the backfill reproduction above.
- **Forums (`0021_forums.sql`, `src/lib/sanitize-forum-html.ts`,
  `src/components/forums/post-editor.tsx`, `/admin/forums`, `/forums`)**
  — admin-managed categories/subcategories, player threads and posts,
  with a WYSIWYG-or-raw-HTML editor and server-side sanitization as the
  actual security boundary.
  - **Schema**: `forum_categories` (self-referencing `parent_id`, nullable
    — a NULL-parent category is "top-level"; the two-level depth is a UI
    convention, not a DB constraint, since only top-level categories are
    ever offered as a parent choice in the admin form) gets the same
    admin-only-write RLS + `log_admin_action()` audit trigger as
    items/species/zones (`0009_admin_panel.sql`). `forum_threads` and
    `forum_posts` are player-authored instead, so they use the plainer
    `pet_folders`-style RLS (`with check (auth.uid() = author_id)`, plus
    an active-category check on thread insert and a not-locked check on
    post insert) rather than a security-definer RPC — there's no
    currency/game-economy stake here, just "you can only post as
    yourself," which that policy already enforces natively. A
    `security definer` trigger (`sync_forum_thread_stats`) keeps
    `forum_threads.reply_count`/`last_post_at` in sync on every post
    insert, the same technique `log_admin_action()` uses to write past a
    client-facing RLS policy that's otherwise admin-only.
  - **The sanitizer is the only security boundary, not the editor**:
    `sanitizeForumHtml()` (`sanitize-html`, Node-only) runs on every post
    write regardless of whether it came from the WYSIWYG editor or
    hand-typed "Code" mode — the client is never trusted either way. It
    allowlists a fixed set of formatting tags and — critically — never
    allowlists `<iframe>`/`<video>`/`<audio>`/`<embed>`/`<object>` at
    all, combined with `disallowedTagsMode: "discard"` (drops the tag
    *and* its contents). That's the entire mechanism behind "players can
    link videos/music but not embed them" — a link is just an `<a>`,
    which stays allowed; an embed tag has nowhere to hide. `<script>`,
    `<style>`, inline event handlers, and `javascript:`/`data:` URLs are
    stripped the ordinary way any HTML sanitizer would.
  - **A Tailwind-specific hole that generic "just sanitize the HTML"
    advice wouldn't catch**: this whole site is styled with global
    Tailwind utility classes, so naively allowing a `class` attribute on
    user content would let a post style itself using the *site's own*
    classes — e.g. `class="fixed inset-0 z-50 bg-black"` as a full-page
    overlay, not just decoration inside the post. `class` is therefore
    never allowed on any tag, full stop. `style` is offered instead for
    the Toyhouse-style custom-look posts this was meant to support, but
    only a fixed per-property allowlist of regex-validated values
    (`color`, `font-*`, `text-*`, `border*`, `padding`/`margin`,
    `width`/`height`) — deliberately excluding `position` (redress again)
    and `background-image` (a `url(...)` is just an embed by another
    name).
  - **Editor component (`PostEditor`)**: one client component shared by
    new-thread and reply forms, holding a single `content` string plus an
    `editor_mode` flag as the two hidden form fields actually submitted.
    Visual mode is TipTap (`StarterKit` + `Underline`/`Link`/`Image`)
    with a small custom toolbar — bold/italic/underline/strike,
    headings, lists, blockquote, link, and image-by-URL — deliberately
    with no video/embed button, matching the sanitizer. Code mode is a
    plain `<textarea>` over the same `content` state. Switching Code →
    Visual calls `editor.commands.setContent(content)` so hand-typed HTML
    loads back into the live editor (TipTap's own schema reinterprets it,
    which is fine — it's a convenience re-parse, not a security step).
    Since `@tailwindcss/typography` isn't installed, a small
    `.forum-content` rule set was added to `globals.css` to style the
    sanitizer's allowed tags (headings, lists, blockquote, tables, code
    blocks) — otherwise Tailwind's preflight reset would render them as
    unstyled text; this same class wraps both the live TipTap editor and
    the rendered `body_html` on thread pages.
  - **Verified two ways**: (1) `sanitizeForumHtml()` itself, run directly
    via `npx tsx` (pure Node, no Supabase/browser needed) against a
    payload combining `<script>`, `<iframe>`, `<video>`, `<audio>`,
    `<embed>`, `<object>`, `<svg onload>`, a `<form>`, `<style>`,
    `<base>`, a `javascript:` image `src` or link `href` with inline
    event handlers, and the Tailwind-class overlay attempt described
    above — confirmed every one of those was stripped to nothing (or had
    just the dangerous attribute/scheme removed, e.g. `<img>` losing its
    `javascript:` `src`), while a plain `<a href="https://…">` link to a
    video URL and a `style="color:…;font-weight:…"` paragraph both
    survived intact, matching "link it, don't embed it" and "safe
    styling still works" exactly. (2) The admin category form and
    `PostEditor` were checked visually with headless Chromium against a
    temporary preview route mounting the client components directly with
    mocked data (deleted before finishing, same as prior modules) — typed
    into the visual editor, switched to Code mode and confirmed the
    textarea held the exact TipTap-generated HTML, edited that raw HTML
    and switched back to Visual to confirm it re-loaded correctly, and
    rendered the sanitizer's output through the real `.forum-content`
    CSS to confirm headings/lists/blockquote/links/styled text all look
    right and the stripped elements leave no visual trace. The
    `0021_forums.sql` schema itself (RLS on all three tables, the
    admin-only category audit trigger, the thread-stats sync trigger,
    author-only edit/locked-thread/deactivated-category enforcement) was
    separately verified against local Postgres 16 (both `psql -f` and
    `psql -1`) before any of the above.
- **Wireframe page layout (`src/app/layout.tsx`, `src/components/
  site-header.tsx`, `site-nav.tsx`, `nav-groups.tsx`, `site-footer.tsx`)**
  — a from-a-wireframe redo of the site-wide chrome: every page now
  renders inside one shared shell, wired once in the root layout rather
  than per page.
  - **Single wrap point, zero per-page changes**: every existing page
    already rendered its own `<main className="mx-auto flex w-full
    max-w-{…} flex-1 flex-col … px-6 py-12">` (a consistent pattern
    across all ~25 routes). Rather than touch every one of those files,
    the white content box was added once in the root layout, wrapping
    `{children}`, itself using `flex flex-1 flex-col` — so each page's
    own `flex-1 main` still stretches to fill it and its own `mx-auto
    max-w-*` still centers/constrains its content exactly as before,
    just inside the box instead of directly on the page background.
  - **Header** (`SiteHeader`) is now just two pieces: a logo placeholder
    (green box, links home — literally a placeholder for real logo art
    later, per the wireframe) and a user-info box (yellow) with the
    existing avatar/coin/gem/sign-out content, or a "Sign in" button
    when signed out. The old inline nav links were pulled out of it
    entirely.
  - **Nav** (`SiteNav` + `NavGroups`) replaces the old flat row of links
    with grouped, foldable sections — Play (Expeditions/Pets/Items/
    Brewing), Trade (Marketplace, plus Trades if `TRADING_ENABLED`),
    Community (Forums), Account (Settings, plus Admin if the signed-in
    user is one) — matching the wireframe's "sections are grouped
    together and fold into a dropdown when clicked." `SiteNav` (server)
    resolves the signed-in user/admin status and builds the group list
    server-side, same pattern as the header; `NavGroups` (client) is the
    interactive part — one group open at a time, click the open one to
    close it, click another to switch, click outside to close. Nav is
    only rendered when signed in, same as the nav it replaced.
  - **Background**: a placeholder diagonal-stripe pattern on `body`
    (`repeating-linear-gradient` over a flat blue, in `globals.css`)
    stands in for the real background image the wireframe calls for
    later — swapping one `background-image` line for `url(...)` when
    that art exists is the entire migration, nothing else about the
    layout depends on it being a pattern specifically.
  - **What deliberately didn't change**: the amber accent palette
    (buttons, links, cards) used throughout individual page content —
    the wireframe only specifies the site-wide chrome (header/nav/
    content box/footer/background), not the content inside the white
    box, so existing page-level styling was left alone.
  - Verified with headless Chromium against the real, unmodified `/`
    route (signed out — this sandbox has no live Supabase project, but
    `createClient()` against a placeholder URL still renders the
    signed-out branch correctly, which is real code, not a mock),
    confirming the logo box, sign-in box, white content box, and footer
    all matched the wireframe. The signed-in header/nav needs a real
    session this sandbox doesn't have, so that part was checked via a
    temporary preview route (deleted before finishing) that mounted the
    actual `NavGroups` component with mock groups next to a hardcoded
    visual replica of the signed-in header — confirmed the fold/dropdown
    interaction (open → switch groups → close-on-outside-click) all
    behave correctly.
- **Forums redesign: BBCode editor + phpBB-style layout
  (`0022_forum_bbcode_and_views.sql`, `src/lib/bbcode.ts`,
  `src/components/forums/*`, `/forums/*`)** — replaced the original
  WYSIWYG-or-raw-HTML forum editor and gave the whole forums section a
  visual overhaul, both from a reference screenshot of a classic
  phpBB/Chicken-Smoothie-style forum.
  - **Why BBCode instead of "sanitize whatever HTML came in"**: the
    previous design (TipTap WYSIWYG + a raw "Code" mode, sanitized with
    `sanitize-html`) meant a player could submit arbitrary HTML that the
    server then had to filter down to something safe — the classic
    allowlist-of-arbitrary-input security model, one missed tag/
    attribute away from a hole. BBCode flips that: a player never
    submits HTML at all, only a fixed vocabulary of `[tag]` markers.
    `bbcodeToHtml()` (`src/lib/bbcode.ts`) is the only code that ever
    writes an HTML tag or attribute — there's no way for a post to
    introduce one this file doesn't already know how to produce, so
    there's nothing to filter *out* in the first place. `editor_mode`
    (wysiwyg vs. raw) is gone entirely — there's only one editor now,
    and typing `[b]` by hand instead of clicking the Bold button already
    *is* the "advanced" option Toyhouse-style raw mode used to be for.
  - **Parser**: a small hand-written tokenizer + recursive-descent tree
    builder (not regex-chaining, which breaks on nesting) — supports
    `[b] [i] [u] [s] [sup] [sub] [h1]-[h3] [quote] [hr] [align=] [size=]
    [color=] [highlight=] [font=] [url] [img]`, correctly nested (e.g.
    `[b][color=...]...[/color][/b]`). An unrecognized tag name, a stray
    closing tag with no opener, or an unclosed tag at EOF all degrade to
    literal text/auto-close rather than erroring — matches how every
    real BBCode forum behaves. `[img]`/bare `[url]` capture their inner
    content raw (never re-parsed as nested BBCode), since a URL
    containing something that looks like a tag should stay literal.
    Still no `[video]`/`[audio]`/`[iframe]`/`[embed]` tag exists at all
    — the video/audio-embed restriction from the original spec now
    holds by construction (there's no code path that could ever emit
    one) rather than by an allowlist someone could get wrong.
  - **What's validated**: `[color=]`/`[highlight=]` against a hex/rgb()/
    named-color regex, `[font=]` against a safe-charset regex,
    `[align=]` against `left/center/right/justify`, `[size=]` against a
    fixed 1-7 lookup table (mapped to em values — no free-form CSS
    length), and `[url=]`/bare `[url]`/`[img]` against an `http(s)/
    mailto` scheme allowlist (blocks `javascript:`/`data:`). An invalid
    value drops just that tag's styling rather than the content inside
    it. Every link gets `target="_blank" rel="noopener noreferrer
    nofollow ugc"` forced on, same as before.
  - Verified directly (`npx tsx`, no browser/DB needed) against the
    mockup's own sample post (confirms nesting renders identically:
    bold, colored+highlighted text, sup/sub, h1/h3) plus a battery of
    adversarial input — a literal `<script>` tag (escaped, inert), fake
    `[video]`/`[iframe]`/`[embed]` tags (no such tag exists, pass
    through as literal bracket text), `javascript:`/`data:` URLs in
    `[url]`/`[img]` (scheme rejected, tag drops to plain text/nothing),
    a CSS-injection attempt via `[color=red;position:fixed;...]` (fails
    the color regex, style dropped, content kept), an unclosed `[b]`
    (auto-closes at EOF), and a stray `[/b]` with no opener (literal
    text) — every case behaved exactly as designed.
  - **Layout**: new shared `ForumPanel`/`ForumPanelSection` (bordered
    box, colored header bar) and `PaginationBar` components used across
    all three forum pages for a consistent look. `/forums` gained a
    "Quick Jump" sidebar (every category/subcategory as a flat list of
    jump links) beside the existing category-index panel. `/forums/
    [categoryId]` now separates pinned topics into their own panel above
    the regular thread list, shows per-thread View and Reply counts, and
    paginates (20 threads/page) instead of loading every thread at once.
    `/forums/[categoryId]/[threadId]` restyled each post as a card
    (avatar, author, timestamp, rendered BBCode) and paginates replies
    (10/page); posts also gained a working **Edit** button (a post's
    author or an admin can revise it — the existing "Authors and admins
    can edit a post" RLS policy from 0021 already allowed this, there
    was just no UI for it yet) and a **Report** button that's
    deliberately inert (grayed out, `disabled`, a tooltip explaining
    it's not built yet) rather than a live-looking control that quietly
    does nothing — full moderation/reporting is a bigger feature than
    this pass was scoped for.
  - **New `view_count`** on `forum_threads`, incremented via a
    `security definer` RPC (`increment_thread_view_count`, granted to
    `anon` as well as `authenticated` — the first anon-granted function
    in this app, since forum threads are publicly readable without
    signing in and view-counting has to work for anonymous visitors
    too) on every thread-page load. Best-effort by design, like most
    forum view counters — not deduplicated per visitor.
  - Removed the TipTap dependency tree entirely (`@tiptap/react`,
    `@tiptap/starter-kit`, `@tiptap/pm`, and the three extension
    packages) along with `sanitize-html`/`@types/sanitize-html` and the
    old `post-editor.tsx`/`sanitize-forum-html.ts` — nothing in the app
    references them anymore, confirmed by grepping before deleting.
  - Verified the `0022` migration the same way as `0021` (local
    Postgres 16, both `psql -f` and `psql -1`): confirmed
    `forum_posts.editor_mode` is gone, `forum_threads.view_count`
    exists and defaults to 0, a non-admin's *direct* `UPDATE` of
    `view_count` is still rejected by the existing admin-only RLS policy
    (`UPDATE 0`), and that same non-admin *can* bump it through
    `increment_thread_view_count()` as both `anon` and `authenticated`.
    The redesigned pages, the BBCode editor's toolbar (bold, font color,
    font size, horizontal-rule-at-cursor — each checked by reading the
    textarea's actual value back after the click, not just eyeballing
    it), and the rendered post cards were checked visually with headless
    Chromium against a temporary preview route mounting the real
    components with mock data (deleted before finishing, same as every
    other module).
- **Forums follow-up fixes: divider categories, reply toggle, preview,
  icons, avatars (`0023_forum_category_no_direct_posts.sql`,
  `src/components/forums/*`, `/forums/*`)** — a round of feedback after
  actually using the redesigned forums.
  - **Parent categories can no longer be posted in.** A top-level
    category with subcategories is a pure divider — just a visual way
    to group forums, not a place threads live. Enforced at the RLS
    layer (rewrote the `forum_threads` INSERT policy to also require
    `not exists (... where parent_id = category_id)`) as the real
    backstop, with app-level checks in `createForumThread` and the
    `/new` page giving a friendly message / redirecting instead of
    showing a form that would only fail on submit — same
    backstop-vs-convenience split every other write path in this app
    uses. A category page for one of these dividers now shows only its
    subcategory list (no "New Post" button, no pinned/thread panels).
    Verified against local Postgres: posting directly in a parent with
    a subcategory is rejected by RLS, while posting in that same
    subcategory, or in an ordinary category with no children, both
    succeed.
  - **Reply box now stays hidden until clicked** (`ReplyToggle`, a small
    client wrapper) — a "Reply" button in place of the always-visible
    form; clicking it mounts the actual reply form (and the BBCode
    editor along with it) rather than showing an empty text box by
    default.
  - **BBCode Preview toggle** — `BBCodeEditor` gained a Preview/Write
    toggle. `bbcodeToHtml()` (`src/lib/bbcode.ts`) is a pure function
    with no DOM/Node dependency, so it runs client-side too: toggling
    Preview renders the current draft through the exact same renderer
    that'll process it server-side on submit, no separate preview-only
    code path to keep in sync. The textarea stays mounted (just
    `hidden`) while previewing so the draft isn't lost switching back.
  - **Emoji replaced with `lucide-react` icons** throughout the forums —
    panel headers, thread pin/lock indicators, Edit/Report buttons, the
    BBCode toolbar (Bold/Italic/Underline/Strikethrough/Quote/
    horizontal-rule/alignment/font-size/font-color all became real
    icons instead of raw Unicode/emoji characters), and pagination
    arrows. Purely cosmetic, but also the excuse for the wider polish
    pass below.
  - **Wider, larger post layout** — the thread view widened from
    `max-w-3xl` to `max-w-5xl` (matching the other forum pages), post
    card padding/avatar size/body text size all increased, and panel
    headers got more breathing room — addresses "everything looks
    cramped/small" in one pass alongside the icon swap, both aimed at
    reading closer to a mature phpBB/Chicken-Smoothie-style forum.
  - **Avatar bug**: post cards were rendering `authorAvatarUrl` through
    a plain `<img>` tag, sent directly to `lh3.googleusercontent.com`
    from the browser — a client-side ad-blocker/privacy extension
    targeting Google's raw image CDN (a common filter-list target) would
    silently break it, even though the exact same avatar URLs render
    fine elsewhere in the app (`site-header.tsx`) via `next/image`, which
    proxies the request through the app's own `/_next/image` endpoint
    instead of hitting Google's domain directly from the browser — and
    that host was already allowlisted in `next.config.ts` for exactly
    this reason. Switched post-card avatars to `next/image` to match.
    Couldn't exercise the real Google-hosted URL from this sandbox (its
    egress proxy blocks `googleusercontent.com`/`placehold.co`, the same
    limitation noted in earlier modules) — verified the `<Image>`
    pipeline itself (sizing, cropping, border) renders correctly using a
    same-origin local asset standing in for the URL instead.
  - Build + lint clean; the RLS change re-verified against local
    Postgres 16 (`psql -f`, plus the full chain again in `psql -1`); the
    rest checked visually with headless Chromium against a temporary
    preview route (deleted before finishing) mounting the real
    `ForumPanel`/`PaginationBar`/`BBCodeEditor`/`ReplyToggle` components,
    including clicking through the Reply toggle and the BBCode Preview
    toggle to confirm both actually work, not just render.
