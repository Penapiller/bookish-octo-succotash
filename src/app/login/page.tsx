import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/profile");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
          Adopt pets, run expeditions, and trade with other players. Sign in
          with your Google account to get started — no password required.
        </p>
      </div>
      <GoogleSignInButton />
    </main>
  );
}
