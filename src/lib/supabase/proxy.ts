import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request so server components
 * always see an up-to-date (or correctly expired) session cookie.
 *
 * This is a convenience refresh only — it must NOT be relied on as the
 * authorization check for protected routes. Every page/action/route that
 * needs a signed-in (or admin) user re-verifies that itself via
 * `supabase.auth.getUser()`, per Next.js's own guidance that Proxy
 * matchers can silently stop covering a route after a refactor.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this call refreshes the session token and must run
  // before any other Supabase calls that depend on cookies in this request.
  await supabase.auth.getUser();

  return response;
}
