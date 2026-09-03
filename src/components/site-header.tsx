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
  let coinBalance: number | null = null;
  let gemBalance: number | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("display_name, avatar_url, coin_balance, gem_balance")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    coinBalance = profile?.coin_balance ?? null;
    gemBalance = profile?.gem_balance ?? null;
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
      {/* Logo placeholder — swap for real logo art later; the link-home
          behavior underneath won't need to change. */}
      <Link
        href="/"
        className="flex min-w-40 flex-col items-center justify-center gap-0.5 rounded-md bg-green-500 px-6 py-3 text-center text-white shadow-sm hover:bg-green-600"
      >
        <span className="text-sm font-bold uppercase tracking-wide">Logo image placeholder</span>
        <span className="text-xs opacity-90">Clicking this returns player to home</span>
      </Link>

      {user ? (
        <div className="flex items-center gap-3 rounded-md bg-yellow-400 px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-900">
            <span title="Coins">🪙 {coinBalance ?? 0}</span>
            <span title="Gems">💎 {gemBalance ?? 0}</span>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 border-l border-stone-900/20 pl-3 text-sm font-medium text-stone-900 hover:underline"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
            ) : null}
            {displayName ?? "Profile"}
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-md border border-stone-900/30 px-2.5 py-1 text-xs text-stone-900 hover:bg-yellow-300"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded-md bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-stone-900 shadow-sm hover:bg-yellow-300"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
