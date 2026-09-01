import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let avatarUrl: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Virtual Pet Site
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <Link href="/expeditions" className="hover:underline">
              Expeditions
            </Link>
            <Link href="/profile" className="flex items-center gap-2 hover:underline">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full"
                />
              ) : null}
              {displayName ?? "Profile"}
            </Link>
            <Link href="/settings" className="hover:underline">
              Settings
            </Link>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
