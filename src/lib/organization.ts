import { prisma } from '@/lib/db';
import { Organization, OrganizationSettings, User, Invitation } from '@prisma/client';
import type {
  OrganizationWithSettings,
  OrganizationWithUsers,
  OrganizationFull,
} from '@/types/organization';

/**
 * Organization utilities for managing organizations, users, and settings
 */

// ============================================================================
// Organization Queries
// ============================================================================

/**
 * Get organization by ID with optional relations
 */
export async function getOrganizationById(
  id: string,
  include?: {
    settings?: boolean;
    users?: boolean;
  }
): Promise<OrganizationWithSettings | OrganizationWithUsers | OrganizationFull | null> {
  return await prisma.organization.findUnique({
    where: { id },
    include: {
      settings: include?.settings ?? false,
      users: include?.users ?? false,
    },
  });
}

/**
 * Get organization by domain (for auto-join feature)
 */
export async function getOrganizationByDomain(domain: string): Promise<Organization | null> {
  return await prisma.organization.findUnique({
    where: { domain },
  });
}

/**
 * Get organization settings
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettings | null> {
  return await prisma.organizationSettings.findUnique({
    where: { organizationId },
  });
}

/**
 * Get or create organization settings
 */
export async function getOrCreateOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettings> {
  let settings = await getOrganizationSettings(organizationId);

  if (!settings) {
    settings = await prisma.organizationSettings.create({
      data: {
        organizationId,
        allowSelfSignup: false,
        allowDomainAutoJoin: false,
      },
    });
  }

  return settings;
}

// ============================================================================
// User Queries
// ============================================================================

/**
 * Get all users in an organization
 */
export async function getUsersInOrganization(
  organizationId: string,
  include?: {
    manager?: boolean;
    directReports?: boolean;
  }
): Promise<User[]> {
  return await prisma.user.findMany({
    where: { organizationId },
    include: {
      manager: include?.manager ?? false,
      directReports: include?.directReports ?? false,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get user with organization and manager relations
 */
export async function getUserWithRelations(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
      manager: true,
      directReports: true,
    },
  });
}

/**
 * Get direct reports for a manager
 */
export async function getDirectReports(managerId: string): Promise<User[]> {
  return await prisma.user.findMany({
    where: { managerId },
    orderBy: { name: 'asc' },
  });
}

/**
 * Check if email domain matches organization domain
 */
export function emailMatchesDomain(email: string, domain: string): boolean {
  const emailDomain = email.split('@')[1];
  return emailDomain?.toLowerCase() === domain.toLowerCase();
}

// ============================================================================
// Invitation Queries
// ============================================================================

/**
 * Get pending invitations for an organization
 */
export async function getPendingInvitations(organizationId: string): Promise<Invitation[]> {
  return await prisma.invitation.findMany({
    where: {
      organizationId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      invitedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  return await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });
}

/**
 * Check if invitation is valid (not expired, not accepted)
 */
export function isInvitationValid(invitation: Invitation): boolean {
  if (invitation.acceptedAt) {
    return false; // Already accepted
  }

  if (new Date() > invitation.expiresAt) {
    return false; // Expired
  }

  return true;
}

// ============================================================================
// Organization Mutations
// ============================================================================

/**
 * Update organization
 */
export async function updateOrganization(
  id: string,
  data: Partial<Pick<Organization, 'name' | 'domain' | 'logo' | 'fiscalYearStartMonth'>>
): Promise<Organization> {
  return await prisma.organization.update({
    where: { id },
    data,
  });
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings(
  organizationId: string,
  data: Partial<
    Pick<
      OrganizationSettings,
      'defaultKanbanView' | 'defaultKanbanTemplateId' | 'allowSelfSignup' | 'allowDomainAutoJoin'
    >
  >
): Promise<OrganizationSettings> {
  // Ensure settings exist
  await getOrCreateOrganizationSettings(organizationId);

  return await prisma.organizationSettings.update({
    where: { organizationId },
    data,
  });
}

// ============================================================================
// User Mutations
// ============================================================================

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  data: Partial<Pick<User, 'name' | 'email' | 'avatarUrl' | 'role' | 'managerId'>>
): Promise<User> {
  return await prisma.user.update({
    where: { id: userId },
    data,
  });
}

/**
 * Assign manager to user
 */
export async function assignManager(userId: string, managerId: string | null): Promise<User> {
  return await prisma.user.update({
    where: { id: userId },
    data: { managerId },
  });
}

// ============================================================================
// Invitation Mutations
// ============================================================================

/**
 * Create invitation
 */
export async function createInvitation(data: {
  email: string;
  role: User['role'];
  organizationId: string;
  invitedById: string;
  expiresAt: Date;
}): Promise<Invitation> {
  return await prisma.invitation.create({
    data: {
      ...data,
      token: generateInvitationToken(),
    },
  });
}

/**
 * Mark invitation as accepted
 */
export async function acceptInvitation(token: string): Promise<Invitation> {
  return await prisma.invitation.update({
    where: { token },
    data: { acceptedAt: new Date() },
  });
}

/**
 * Delete invitation
 */
export async function deleteInvitation(id: string): Promise<void> {
  await prisma.invitation.delete({
    where: { id },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique invitation token
 */
function generateInvitationToken(): string {
  // Use crypto for secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate default invitation expiration (7 days from now)
 */
export function getDefaultInvitationExpiration(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

/**
 * Check if user can join organization via domain
 */
export async function canAutoJoinByDomain(email: string): Promise<Organization | null> {
  const domain = email.split('@')[1];
  if (!domain) return null;

  const org = await prisma.organization.findFirst({
    where: {
      domain: domain.toLowerCase(),
    },
    include: {
      settings: true,
    },
  });

  if (org && org.settings?.allowDomainAutoJoin) {
    return org;
  }

  return null;
}
