import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// ?banned=account&until=...&reason=... is set by /auth/callback when an
// account-banned player tries to sign in — the OAuth handshake itself
// can't be intercepted, so the session is allowed, checked, then
// immediately signed back out and redirected here with these params
// before this page ever renders a "you're signed in" state for them.
export default async function Home(props: PageProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const searchParams = await props.searchParams;
  const banned = first(searchParams.banned);
  const until = first(searchParams.until);
  const reason = first(searchParams.reason);

  if (banned === "account") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-red-700 dark:text-red-400">
          Your account is banned
        </h1>
        <p className="max-w-md text-lg text-stone-600 dark:text-stone-400">
          You can&apos;t sign in right now.
          {until ? ` This ban is in effect until ${new Date(until).toLocaleString()}.` : ""}
        </p>
        {reason ? (
          <p className="max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            &ldquo;{reason}&rdquo;
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      {/* Hero image placeholder — swap for the real Furgarden Hero art
          (drop it in game-assets/other/, same convention as every other
          asset this app wires in) once it's actually in the repo; this
          reserves the same wide-banner shape/aspect ratio so nothing
          else needs to move when it's swapped in. */}
      <div className="flex aspect-[2/1] w-full max-w-2xl flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-400 bg-gradient-to-b from-sky-200 to-green-200 text-green-950 dark:border-green-700 dark:from-sky-950 dark:to-green-950 dark:text-green-100">
        <span className="text-sm font-bold uppercase tracking-wide">Furgarden hero image placeholder</span>
        <span className="text-xs opacity-80">Drop the real art in game-assets/other/ to swap this in</span>
      </div>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
        Adopt, hatch, and trade virtual pets
      </h1>
      <p className="max-w-md text-lg text-stone-600 dark:text-stone-400">
        Send your pets on expeditions, brew potions, offer items to the
        statue, and build your collection.
      </p>
      <Link
        href={user ? "/profile" : "/login"}
        className="rounded-md bg-green-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {user ? "Go to your profile" : "Sign in with Google"}
      </Link>
    </main>
  );
}
