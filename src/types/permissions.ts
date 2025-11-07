import { User, Opportunity, Account, UserRole } from '@prisma/client';

// Permission check function types
export type PermissionCheck<T = unknown> = (user: User, resource?: T) => boolean;

// Visibility types
export interface VisibilityContext {
  userId: string;
  role: UserRole;
  organizationId: string;
  managerId?: string | null;
  directReportIds: string[];
}

// Permission types
export interface CanViewOpportunity {
  (user: User, opportunity: Opportunity): boolean;
}

export interface CanEditOpportunity {
  (user: User, opportunity: Opportunity): boolean;
}

export interface CanDeleteOpportunity {
  (user: User, opportunity: Opportunity): boolean;
}

export interface CanViewAccount {
  (user: User, account: Account): boolean;
}

export interface CanEditAccount {
  (user: User, account: Account): boolean;
}

// Admin permissions
export interface CanManageUsers {
  (user: User): boolean;
}

export interface CanInviteUsers {
  (user: User): boolean;
}

export interface CanManageOrgSettings {
  (user: User): boolean;
}

// Visibility helpers
export interface GetVisibleUserIds {
  (user: User, directReports?: User[]): string[];
}
