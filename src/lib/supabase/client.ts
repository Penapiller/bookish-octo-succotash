import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Supabase client for use in Client Components. Reads the session from
 * cookies set by the server (see `proxy.ts` / `src/lib/supabase/server.ts`).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
