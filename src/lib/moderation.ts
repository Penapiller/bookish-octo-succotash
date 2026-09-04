import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate for every /mod page and every mod Server Action — deliberately
 * separate from requireAdmin() (src/lib/admin.ts), not a shared helper
 * with a role parameter, so it's obvious at a glance which surfaces are
 * moderator-reachable vs admin-only. Passes for is_moderator OR is_admin
 * (an admin has every moderator power too); requireAdmin() stays
 * is_admin-only, so a moderator who isn't also an admin can reach /mod
 * but never /admin. Same "layout gate isn't sufficient by itself, every
 * Server Action re-checks too, RLS is the real backstop" reasoning as
 * requireAdmin() — see 0027_moderation.sql for the RLS side.
 */
export async function requireModerator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin, is_moderator")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin && !profile?.is_moderator) {
    redirect("/");
  }

  return { supabase, user };
}
