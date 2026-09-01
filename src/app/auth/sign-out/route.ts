import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST-only by design (invoked from a <form>) so sign-out can't be
 * triggered by a prefetched or crawled GET link.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
