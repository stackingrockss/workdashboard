import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only run middleware on routes that need authentication.
     * Exclude all static assets and API routes.
     */
    "/opportunities/:path*",
    "/dashboard/:path*",
    "/auth/callback",
  ],
};
