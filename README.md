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

## Getting started

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com). You'll need its
Project URL and anon public key from **Project Settings → API**.

### 2. Run the database migration

Open the SQL Editor in your Supabase project and run the contents of
[`supabase/migrations/0001_init_users.sql`](./supabase/migrations/0001_init_users.sql).
(If you use the [Supabase CLI](https://supabase.com/docs/guides/cli) locally,
`supabase db push` will apply everything in `supabase/migrations/` instead.)

This creates the `public.users` profile table (auto-populated on first
sign-in via a trigger on `auth.users`), row-level security policies scoping
each user to their own row, a server-side guard that stops non-admin updates
from touching privileged columns (`is_admin`, `currency_balance`,
`den_size`), and a `public.user_profiles` view that safely exposes only
public-facing fields for profile pages.

Future modules will add their own migration files under
`supabase/migrations/`, applied the same way, in order.

### 3. Enable Google sign-in

In the Supabase dashboard, go to **Authentication → Sign In / Providers →
Google** and enable it. You'll need a Google OAuth Client ID/Secret from the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) —
create an "OAuth client ID" of type "Web application" and add Supabase's
callback URL (shown on that same settings page, looks like
`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) as an authorized
redirect URI.

In **Authentication → URL Configuration**, set the Site URL to your app's
URL (e.g. `http://localhost:3000` in development) and add it — plus your
Vercel preview domains — to the Redirect URLs allow list.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
step 1. Set the same two variables in your Vercel project settings for
deploy previews/production.

### 5. Run the app

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in with
Google.

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
