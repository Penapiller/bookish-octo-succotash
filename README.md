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
      of a pet (blue = pet art, green = item art, for easy testing), and a
      new "Inventory" tab shows owned pets and item stacks
- [x] Potions & brewing — a "Brewing" tab with fixed, shared recipes
      (click a potion to see its ingredients and brew it), purple potion
      art, and real potions now consumed on the expeditions map (replacing
      the old testing checkbox) to shorten an expedition's timer
- [ ] Layered pet art rendering, accessory equip/unequip
- [ ] Currency & den expansion (den cap is temporarily raised to 25 for
      testing — see Notes below to find where to lower it back down)
- [ ] Statue offerings
- [ ] Trading
- [ ] Profile customization (sanitized custom CSS/HTML)
- [ ] Forums
- [ ] Admin panel & audit log

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
  only works unhinted while there's exactly one foreign key between the
  two tables. `expeditions` now has two FKs to `items`
  (`pending_item_id`, `result_item_id`), so a plain `items(...)` embed
  from `expeditions` fails at request time with an embedding-ambiguity
  error — it doesn't fail typecheck or build, since the query is just a
  string, so this only surfaces when the code path actually runs (here:
  opening the claim popup). The fix is a `!constraint_name` hint, e.g.
  `items!expeditions_pending_item_id_fkey(...)` (see
  `claim-reward-modal.tsx`) — find the real constraint name with
  `select conname from pg_constraint where conrelid='expeditions'::regclass
  and confrelid='items'::regclass;` rather than guessing at it. `pets` has
  the same latent double-FK from `expeditions` (`pet_id`, `result_pet_id`)
  — nothing currently embeds `pets` from `expeditions`, but the next
  query that does will need the same hint.
- Species/zone art currently just points at
  [placehold.co](https://placehold.co) placeholder images, and zone/species
  names and descriptions are explicitly placeholder text (not real game
  content) — both are meant to be replaced once real art assets exist and
  the admin panel can manage them.
- Potions are real now (`0006_potions_and_brewing.sql`): the expeditions
  map's potion dropdown passes the chosen potion's item id as
  `start_expedition`'s `p_potion_item_id`, which looks up that potion's
  recipe for its `effect_type`/`effect_magnitude`, consumes one from
  `user_inventory`, and (for `duration_reduction`) shaves that fraction
  off the randomized 2-3 minute base roll — still never a guarantee, just
  a shifted range, per spec. `rarity_boost` is defined in the
  `potion_effect_type` enum and a potion can be brewed with it, but
  nothing reads it yet — `pick_weighted_zone_reward` (the roll expeditions
  use) doesn't take a bias input. Wiring that up is the next piece if a
  rarity-boosting potion is wanted for real, not just accepted and
  silently inert.
- Recipes are fixed and identical for every player — no per-user
  discovery/unlock state, matching spec ("no player-driven discovery at
  launch"). The brewing page's "recipes you've found" framing is just
  copy for the shared recipe book, not a gating mechanic; new recipes are
  meant to be added by the (not yet built) admin panel via `potion_recipes`
  / `potion_recipe_ingredients`, the same way zones/items/species are
  today — direct SQL inserts in a migration until then.
- `users.den_size` is temporarily defaulted to **25** instead of 3
  (`0006_potions_and_brewing.sql`, both the column default and a one-time
  `UPDATE` on existing rows) to make testing easier with more pets in
  flight. Lower it back with another migration — `ALTER TABLE users ALTER
  COLUMN den_size SET DEFAULT <n>;` plus an `UPDATE` for existing accounts
  — once real balancing starts; the currency/den-expansion module will
  likely replace this flat default with the spec's cost-curve-driven
  expansion anyway.
- A next/image quirk worth knowing if you add more images: Tailwind's
  Preflight CSS resets `img { height: auto }` globally, which fights with
  next/image's fixed `width`/`height` props unless you *also* pin both
  dimensions via a matching Tailwind class (e.g. `width={64} height={64}
  className="h-16 w-16"`) — otherwise Next.js logs an "either width or
  height modified, but not the other" warning in dev. Images using `fill`
  instead of `width`/`height` aren't affected (its inline styles already
  win over Preflight).
