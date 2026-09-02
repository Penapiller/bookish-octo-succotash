import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PublicProfilePage(
  props: PageProps<"/u/[id]">,
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    notFound();
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
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-amber-200 dark:bg-stone-800" />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.display_name}
          </h1>
          <p className="text-sm text-stone-500">Joined {joined}</p>
        </div>
      </div>

      {profile.bio ? (
        <p className="whitespace-pre-wrap text-stone-700 dark:text-stone-300">
          {profile.bio}
        </p>
      ) : (
        <p className="text-stone-500 italic">This player hasn&apos;t written a bio yet.</p>
      )}
    </main>
  );
}
