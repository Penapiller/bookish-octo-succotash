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
- [ ] Pets, inventory, layered art rendering
- [ ] Expeditions
- [ ] Potions & brewing
- [ ] Currency & den expansion
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
someone signs in. Future development phases will add more `.sql` files to
that same folder — run each new one the same way, in order, as they're
added.

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
