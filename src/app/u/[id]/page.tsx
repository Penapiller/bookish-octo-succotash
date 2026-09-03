import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus, MessageCircle, Flag, PawPrint, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { bbcodeToHtml } from "@/lib/bbcode";
import { DisabledActionButton } from "@/components/disabled-action-button";

export default async function PublicProfilePage(
  props: PageProps<"/u/[id]">,
) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const isOwnProfile = viewer?.id === profile.id;

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <div className="h-[72px] w-[72px] shrink-0 rounded-full bg-amber-200 dark:bg-stone-800" />
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.display_name}
              </h1>
              <p className="text-sm text-stone-500">Joined {joined}</p>
            </div>
          </div>

          {!isOwnProfile ? (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Interact
              </h2>
              <div className="flex flex-wrap gap-2">
                <DisabledActionButton icon={UserPlus} label="Add friend" title="Friending isn't available yet" />
                <DisabledActionButton icon={MessageCircle} label="Send DM" title="Messaging isn't available yet" />
                {TRADING_ENABLED && viewer ? (
                  <Link
                    href={`/trades/new?to=${encodeURIComponent(profile.display_name)}`}
                    className="rounded-md bg-amber-800 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
                  >
                    Propose a trade
                  </Link>
                ) : null}
                <DisabledActionButton icon={Flag} label="Report player" title="Reporting isn't available yet" />
              </div>
            </div>
          ) : null}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              {profile.display_name}&apos;s stuff
            </h2>
            <div className="flex gap-3">
              <DisabledActionButton
                icon={PawPrint}
                label="Pets"
                title="Browsing another player's pets isn't available yet"
              />
              <DisabledActionButton
                icon={Package}
                label="Items"
                title="Browsing another player's items isn't available yet"
              />
            </div>
          </div>

          <div className="flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-amber-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Bio</h2>
            {profile.bio ? (
              // bbcodeToHtml() is the only thing ever allowed to turn user text
              // into HTML — see src/lib/bbcode.ts. Runs fresh on every render;
              // profile.bio is raw BBCode source, never rendered directly.
              <div
                className="forum-content text-stone-700 dark:text-stone-300"
                dangerouslySetInnerHTML={{ __html: bbcodeToHtml(profile.bio) }}
              />
            ) : (
              <p className="text-stone-500 italic">This player hasn&apos;t written a bio yet.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
