import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate for every /admin page and every admin Server Action. The layout
 * calling this is not by itself a sufficient boundary (Next.js docs: a
 * Server Action is reachable directly, not only through the page that
 * renders its form) — so every admin Server Action calls this too, not
 * just admin/layout.tsx. The database's own RLS policies (see
 * 0009_admin_panel.sql) are the real backstop if this check were ever
 * skipped.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return { supabase, user };
}
