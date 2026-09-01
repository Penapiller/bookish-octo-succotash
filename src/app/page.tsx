import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
        Adopt, hatch, and trade virtual pets
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Send your pets on expeditions, brew potions, offer items to the
        statue, and build your collection.
      </p>
      <Link
        href={user ? "/profile" : "/login"}
        className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {user ? "Go to your profile" : "Sign in with Google"}
      </Link>
    </main>
  );
}
