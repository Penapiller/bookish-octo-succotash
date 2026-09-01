import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("display_name, bio")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Failed to load account settings.");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
      <SettingsForm displayName={profile.display_name} bio={profile.bio ?? ""} />
    </main>
  );
}
