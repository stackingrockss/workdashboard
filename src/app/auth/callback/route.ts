import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler for Supabase authentication
 * Exchanges authorization code for session and redirects to app
 *
 * Note: User creation and org assignment is handled by getCurrentUser()
 * in lib/auth.ts when the user first accesses a protected route
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/opportunities";

  console.log("[auth/callback] Processing callback with code:", code ? "present" : "missing");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Failed to exchange code for session:", error.message);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    console.log("[auth/callback] Successfully exchanged code for session, redirecting to:", next);

    // User creation and org assignment happens in getCurrentUser() on first protected route access
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    } else {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with some instructions
  console.error("[auth/callback] No code provided in callback URL");
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
