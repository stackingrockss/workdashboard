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
 * Includes organization, manager, and direct reports relations
 */
export async function getCurrentUser(): Promise<(PrismaUser & {
  organization: { id: string; name: string; fiscalYearStartMonth: number };
  directReports: PrismaUser[];
}) | null> {
  const supabaseUser = await getCurrentSupabaseUser();

  if (!supabaseUser) {
    return null;
  }

  // Find user in Prisma database with relations
  let user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          fiscalYearStartMonth: true,
        },
      },
      directReports: true,
    },
  });

  if (!user) {
    // For new users, check if they can auto-join an organization by domain
    const email = supabaseUser.email!;
    const domain = email.split('@')[1];

    let organizationId: string | null = null;

    if (domain) {
      // Check for domain-based auto-join
      const orgWithAutoJoin = await prisma.organization.findFirst({
        where: {
          domain: domain.toLowerCase(),
          settings: {
            allowDomainAutoJoin: true,
          },
        },
      });

      if (orgWithAutoJoin) {
        organizationId = orgWithAutoJoin.id;
      }
    }

    // Check for pending invitation
    if (!organizationId) {
      const invitation = await prisma.invitation.findFirst({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (invitation) {
        organizationId = invitation.organizationId;

        // Mark invitation as accepted
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
      }
    }

    // If still no organization, create a new one for this user
    if (!organizationId) {
      const newOrg = await prisma.organization.create({
        data: {
          name: `${supabaseUser.user_metadata?.name || email.split('@')[0]}'s Organization`,
          fiscalYearStartMonth: 1,
        },
      });

      organizationId = newOrg.id;

      // Create default organization settings
      await prisma.organizationSettings.create({
        data: {
          organizationId: newOrg.id,
          allowSelfSignup: false,
          allowDomainAutoJoin: false,
        },
      });
    }

    // Create user with organization
    user = await prisma.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email,
        name: supabaseUser.user_metadata?.name || email.split('@')[0],
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
        organizationId,
        role: 'ADMIN', // First user in org is always admin
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            fiscalYearStartMonth: true,
          },
        },
        directReports: true,
      },
    });
  }

  return user;
}

/**
 * Requires authentication - throws error if user is not authenticated
 * Use this in API routes to enforce authentication
 * Returns user with organization and directReports relations
 */
export async function requireAuth(): Promise<PrismaUser & {
  organization: { id: string; name: string; fiscalYearStartMonth: number };
  directReports: PrismaUser[];
}> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
