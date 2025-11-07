import { User, Opportunity, Account, UserRole } from '@prisma/client';

/**
 * Permission System for Sales Opportunity Tracker
 *
 * Role Hierarchy:
 * - ADMIN: Full access to all organization data and settings
 * - MANAGER: Can view/edit own + direct reports' data, invite users
 * - REP: Can view/edit only own data
 * - VIEWER: Read-only access to own data
 */

// ============================================================================
// Role Checks
// ============================================================================

export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN;
}

export function isManager(user: User): boolean {
  return user.role === UserRole.MANAGER;
}

export function isRep(user: User): boolean {
  return user.role === UserRole.REP;
}

export function isViewer(user: User): boolean {
  return user.role === UserRole.VIEWER;
}

export function isAdminOrManager(user: User): boolean {
  return isAdmin(user) || isManager(user);
}

// ============================================================================
// Visibility Helpers
// ============================================================================

/**
 * Get list of user IDs whose data this user can see
 * - REP: Own ID only
 * - MANAGER: Own ID + direct reports
 * - ADMIN: All users in organization (query separately)
 * - VIEWER: Own ID only
 */
export function getVisibleUserIds(user: User, directReports?: User[]): string[] {
  if (isAdmin(user)) {
    // Admin can see all - return empty array to indicate "no filter needed"
    // Caller should query all users in organization
    return [];
  }

  if (isManager(user) && directReports && directReports.length > 0) {
    return [user.id, ...directReports.map(r => r.id)];
  }

  // REP and VIEWER only see their own data
  return [user.id];
}

/**
 * Check if user can see another user's data
 */
export function canViewUserData(viewer: User, targetUserId: string, viewerDirectReports?: User[]): boolean {
  if (isAdmin(viewer)) {
    return true; // Admin can see all
  }

  if (viewer.id === targetUserId) {
    return true; // Can always see own data
  }

  if (isManager(viewer) && viewerDirectReports) {
    return viewerDirectReports.some(r => r.id === targetUserId);
  }

  return false;
}

// ============================================================================
// Opportunity Permissions
// ============================================================================

/**
 * Check if user can view an opportunity
 */
export function canViewOpportunity(user: User, opportunity: Opportunity, directReports?: User[]): boolean {
  // Same organization check
  if (user.organizationId !== opportunity.organizationId) {
    return false;
  }

  // Admin can view all in organization
  if (isAdmin(user)) {
    return true;
  }

  // Own opportunities
  if (opportunity.ownerId === user.id) {
    return true;
  }

  // Managers can view direct reports' opportunities
  if (isManager(user) && directReports) {
    return directReports.some(r => r.id === opportunity.ownerId);
  }

  return false;
}

/**
 * Check if user can edit an opportunity
 */
export function canEditOpportunity(user: User, opportunity: Opportunity, directReports?: User[]): boolean {
  // Viewers can't edit anything
  if (isViewer(user)) {
    return false;
  }

  // Must be able to view it first
  if (!canViewOpportunity(user, opportunity, directReports)) {
    return false;
  }

  // Admin can edit all
  if (isAdmin(user)) {
    return true;
  }

  // Own opportunities
  if (opportunity.ownerId === user.id) {
    return true;
  }

  // Managers can edit direct reports' opportunities
  if (isManager(user) && directReports) {
    return directReports.some(r => r.id === opportunity.ownerId);
  }

  return false;
}

/**
 * Check if user can delete an opportunity
 */
export function canDeleteOpportunity(user: User, opportunity: Opportunity, directReports?: User[]): boolean {
  // Same rules as edit for now
  return canEditOpportunity(user, opportunity, directReports);
}

/**
 * Check if user can reassign an opportunity (change owner)
 */
export function canReassignOpportunity(user: User, opportunity: Opportunity, directReports?: User[]): boolean {
  // Only admins and managers can reassign
  if (!isAdminOrManager(user)) {
    return false;
  }

  return canEditOpportunity(user, opportunity, directReports);
}

// ============================================================================
// Account Permissions
// ============================================================================

/**
 * Check if user can view an account
 */
export function canViewAccount(user: User, account: Account): boolean {
  // Same organization check
  if (user.organizationId !== account.organizationId) {
    return false;
  }

  // For now, anyone in the organization can view accounts
  // This can be restricted later if needed
  return true;
}

/**
 * Check if user can edit an account
 */
export function canEditAccount(user: User, account: Account): boolean {
  if (!canViewAccount(user, account)) {
    return false;
  }

  // Viewers can't edit
  if (isViewer(user)) {
    return false;
  }

  // Admin can edit all
  if (isAdmin(user)) {
    return true;
  }

  // Account owner can edit
  if (account.ownerId && account.ownerId === user.id) {
    return true;
  }

  // Managers can edit accounts
  if (isManager(user)) {
    return true;
  }

  return false;
}

// ============================================================================
// User Management Permissions
// ============================================================================

/**
 * Check if user can manage users (invite, update roles, etc.)
 */
export function canManageUsers(user: User): boolean {
  return isAdmin(user);
}

/**
 * Check if user can invite users to the organization
 */
export function canInviteUsers(user: User): boolean {
  return isAdminOrManager(user);
}

/**
 * Check if user can update another user's role
 */
export function canUpdateUserRole(user: User): boolean {
  return isAdmin(user);
}

/**
 * Check if user can assign managers to other users
 */
export function canAssignManager(user: User): boolean {
  return isAdmin(user);
}

/**
 * Check if user can deactivate/remove users
 */
export function canDeactivateUser(user: User): boolean {
  return isAdmin(user);
}

// ============================================================================
// Organization Settings Permissions
// ============================================================================

/**
 * Check if user can manage organization settings
 */
export function canManageOrgSettings(user: User): boolean {
  return isAdmin(user);
}

/**
 * Check if user can view organization settings
 */
export function canViewOrgSettings(user: User): boolean {
  // All users can view basic org settings
  return true;
}

// ============================================================================
// Dashboard & Reporting Permissions
// ============================================================================

/**
 * Check if user can view team dashboards/metrics
 */
export function canViewTeamDashboard(user: User): boolean {
  return isAdminOrManager(user);
}

/**
 * Check if user can view individual user metrics
 */
export function canViewUserMetrics(user: User, targetUserId: string, directReports?: User[]): boolean {
  if (user.id === targetUserId) {
    return true; // Can view own metrics
  }

  return canViewUserData(user, targetUserId, directReports);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Throw error if user doesn't have permission
 */
export function requirePermission(hasPermission: boolean, message = 'Permission denied'): void {
  if (!hasPermission) {
    throw new Error(message);
  }
}

/**
 * Check if user is in the same organization as a resource
 */
export function isSameOrganization(user: User, organizationId: string): boolean {
  return user.organizationId === organizationId;
}
