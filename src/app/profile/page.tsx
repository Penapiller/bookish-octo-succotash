import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Failed to load profile for the signed-in user.");
  }

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.display_name}
          </h1>
          <p className="text-sm text-zinc-500">Joined {joined}</p>
        </div>
      </div>

      {profile.bio ? (
        <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {profile.bio}
        </p>
      ) : (
        <p className="text-zinc-500 italic">
          No bio yet.{" "}
          <Link href="/settings" className="underline">
            Add one
          </Link>
          .
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Currency</dt>
          <dd className="text-lg font-medium">{profile.currency_balance}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Den size</dt>
          <dd className="text-lg font-medium">{profile.den_size}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pets owned</dt>
          <dd className="text-lg font-medium">
            0 <span className="text-xs text-zinc-500">(pets coming soon)</span>
          </dd>
        </div>
      </dl>

      <div className="flex gap-3">
        <Link
          href="/settings"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Edit profile
        </Link>
        <Link
          href={`/u/${profile.id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          View public profile
        </Link>
      </div>
    </main>
  );
}
