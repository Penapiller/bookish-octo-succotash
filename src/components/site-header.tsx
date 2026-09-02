import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let isAdmin = false;
  let coinBalance: number | null = null;
  let gemBalance: number | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("display_name, avatar_url, is_admin, coin_balance, gem_balance")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    isAdmin = profile?.is_admin ?? false;
    coinBalance = profile?.coin_balance ?? null;
    gemBalance = profile?.gem_balance ?? null;
  }

  return (
    <header className="border-b-4 border-amber-950 bg-gradient-to-b from-amber-700 to-amber-800 px-4 py-3 shadow-md dark:border-stone-950 dark:from-stone-800 dark:to-stone-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link href="/" className="shrink-0">
          <span className="text-2xl font-extrabold tracking-tight text-amber-50 [text-shadow:0_2px_0_rgba(0,0,0,0.25)]">
            Virtual Pet Site
          </span>
        </Link>

        {user ? (
          <nav className="flex flex-wrap items-center gap-1 rounded-full bg-amber-950/30 px-2 py-1 text-sm font-semibold dark:bg-stone-950/50">
            <Link
              href="/expeditions"
              className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
            >
              Expeditions
            </Link>
            <Link
              href="/pets"
              className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
            >
              Pets
            </Link>
            <Link
              href="/items"
              className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
            >
              Items
            </Link>
            <Link
              href="/brewing"
              className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
            >
              Brewing
            </Link>
            <Link
              href="/marketplace"
              className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
            >
              Marketplace
            </Link>
            {TRADING_ENABLED ? (
              <Link
                href="/trades"
                className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
              >
                Trades
              </Link>
            ) : null}
            <Link
              href="/settings"
              className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
            >
              Settings
            </Link>
            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-full px-3 py-1.5 text-amber-50 hover:bg-amber-950/30 dark:hover:bg-stone-950/50"
              >
                Admin
              </Link>
            ) : null}
          </nav>
        ) : null}

        {user ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-950 bg-amber-50 px-3 py-1.5 shadow-inner dark:border-stone-950 dark:bg-stone-900">
            <div className="flex items-center gap-2 text-sm font-medium text-stone-900 dark:text-amber-50">
              <span title="Coins">🪙 {coinBalance ?? 0}</span>
              <span title="Gems">💎 {gemBalance ?? 0}</span>
            </div>
            <Link
              href="/profile"
              className="flex items-center gap-2 border-l border-amber-300 pl-3 text-sm font-medium text-stone-900 hover:underline dark:border-stone-700 dark:text-amber-50"
            >
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
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md border border-amber-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-amber-100 dark:border-stone-700 dark:text-amber-100 dark:hover:bg-stone-800"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-2xl border-2 border-amber-950 bg-amber-50 px-5 py-2 text-sm font-semibold text-stone-900 shadow-inner hover:bg-amber-100 dark:border-stone-950 dark:bg-stone-900 dark:text-amber-50 dark:hover:bg-stone-800"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
