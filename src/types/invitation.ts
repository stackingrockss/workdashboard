import { Invitation, UserRole, User, Organization } from '@prisma/client';

// Invitation with relations
export type InvitationWithRelations = Invitation & {
  organization: Organization;
  invitedBy: User;
};

// Invitation creation input
export interface InvitationCreateInput {
  email: string;
  role: UserRole;
  organizationId: string;
  invitedById: string;
  expiresAt: Date;
}

// Invitation accept input
export interface InvitationAcceptInput {
  token: string;
  name: string;
  password: string;
}

// Invitation status
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export function getInvitationStatus(invitation: Invitation): InvitationStatus {
  if (invitation.acceptedAt) {
    return 'accepted';
  }
  if (new Date() > invitation.expiresAt) {
    return 'expired';
  }
  return 'pending';
}
