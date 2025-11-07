import { Organization, OrganizationSettings, User, UserRole } from '@prisma/client';

// Organization with relations
export type OrganizationWithSettings = Organization & {
  settings: OrganizationSettings | null;
};

export type OrganizationWithUsers = Organization & {
  users: User[];
};

export type OrganizationFull = Organization & {
  settings: OrganizationSettings | null;
  users: User[];
};

// User role type
export type { UserRole };

// User with organization
export type UserWithOrganization = User & {
  organization: Organization;
};

export type UserWithManager = User & {
  manager: User | null;
  directReports: User[];
};

export type UserFull = User & {
  organization: Organization;
  manager: User | null;
  directReports: User[];
};

// Organization creation/update types
export interface OrganizationCreateInput {
  name: string;
  domain?: string;
  logo?: string;
  fiscalYearStartMonth?: number;
}

export interface OrganizationUpdateInput {
  name?: string;
  domain?: string;
  logo?: string;
  fiscalYearStartMonth?: number;
}

// Organization settings types
export interface OrganizationSettingsInput {
  defaultKanbanView?: string;
  defaultKanbanTemplateId?: string;
  allowSelfSignup?: boolean;
  allowDomainAutoJoin?: boolean;
}

// User management types
export interface UserUpdateInput {
  name?: string;
  email?: string;
  avatarUrl?: string;
  role?: UserRole;
  managerId?: string | null;
}

export interface UserInviteInput {
  email: string;
  role: UserRole;
  managerId?: string;
}
