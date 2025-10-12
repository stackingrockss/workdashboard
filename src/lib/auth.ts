import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as PrismaUser } from "@prisma/client";

/**
 * Gets the current authenticated user from Supabase
 * Returns null if not authenticated
 */
export async function getCurrentSupabaseUser(): Promise<SupabaseUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Gets or creates the Prisma user record for the current Supabase user
 * This syncs Supabase auth users with our Prisma User table
 */
export async function getCurrentUser(): Promise<PrismaUser | null> {
  const supabaseUser = await getCurrentSupabaseUser();

  if (!supabaseUser) {
    return null;
  }

  // Find or create user in Prisma database
  let user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (!user) {
    // Create user if doesn't exist
    user = await prisma.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.user_metadata?.name || supabaseUser.email!.split("@")[0],
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
      },
    });
  }

  return user;
}

/**
 * Requires authentication - throws error if user is not authenticated
 * Use this in API routes to enforce authentication
 */
export async function requireAuth(): Promise<PrismaUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
