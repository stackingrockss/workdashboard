/**
 * Gong Call Matching Utility
 *
 * Matches Gong calls to opportunities and accounts based on participant emails
 * and domain patterns.
 */

import { prisma } from '@/lib/db';
import type { GongCallMatchResult, GongParty } from './types';

/**
 * Extract external participant emails from Gong parties
 */
export function extractExternalEmails(parties: GongParty[]): string[] {
  return parties
    .filter((p) => p.context === 'External' && p.emailAddress)
    .map((p) => p.emailAddress!)
    .filter((email) => email.includes('@'));
}

/**
 * Extract email domain from an email address
 */
export function extractDomain(email: string): string | null {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/**
 * Match a Gong call to an opportunity/account based on participant emails
 *
 * Strategy:
 * 1. Try exact email match to Contacts -> get opportunityId or accountId
 * 2. Try domain match to Opportunity.domain field
 * 3. Try domain match to Account.website
 * 4. Return null for unmatched calls (will be created as unlinked)
 */
export async function matchCallToOpportunity(
  externalEmails: string[],
  organizationId: string
): Promise<GongCallMatchResult> {
  // Strategy 1: Exact email match to Contact
  for (const email of externalEmails) {
    const contact = await prisma.contact.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        OR: [
          { opportunity: { organizationId } },
          { account: { organizationId } },
        ],
      },
      include: {
        opportunity: true,
        account: {
          include: {
            opportunities: {
              where: {
                organizationId,
                stage: { notIn: ['closedWon', 'closedLost'] },
              },
              orderBy: { closeDate: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (contact) {
      // If contact has a direct opportunity link
      if (contact.opportunityId && contact.opportunity) {
        return {
          opportunityId: contact.opportunityId,
          accountId: contact.opportunity.accountId,
          matchedBy: 'contact_email',
          confidence: 'high',
        };
      }

      // If contact is linked to an account, get the first open opportunity
      if (contact.accountId && contact.account) {
        const opportunity = contact.account.opportunities[0];
        if (opportunity) {
          return {
            opportunityId: opportunity.id,
            accountId: contact.accountId,
            matchedBy: 'contact_email',
            confidence: 'medium',
          };
        }

        // Account matched but no open opportunities
        return {
          opportunityId: null,
          accountId: contact.accountId,
          matchedBy: 'contact_email',
          confidence: 'medium',
        };
      }
    }
  }

  // Strategy 2: Domain match to Opportunity.domain field
  const domains = new Set(
    externalEmails.map(extractDomain).filter((d): d is string => d !== null)
  );

  for (const domain of domains) {
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        organizationId,
        domain: { equals: domain, mode: 'insensitive' },
        stage: { notIn: ['closedWon', 'closedLost'] },
      },
      orderBy: { closeDate: 'asc' },
    });

    if (opportunity) {
      return {
        opportunityId: opportunity.id,
        accountId: opportunity.accountId,
        matchedBy: 'opportunity_domain',
        confidence: 'high',
      };
    }
  }

  // Strategy 3: Domain match to Account.website
  for (const domain of domains) {
    const account = await prisma.account.findFirst({
      where: {
        organizationId,
        website: { contains: domain, mode: 'insensitive' },
      },
      include: {
        opportunities: {
          where: {
            organizationId,
            stage: { notIn: ['closedWon', 'closedLost'] },
          },
          orderBy: { closeDate: 'asc' },
          take: 1,
        },
      },
    });

    if (account) {
      const opportunity = account.opportunities[0];
      if (opportunity) {
        return {
          opportunityId: opportunity.id,
          accountId: account.id,
          matchedBy: 'account_domain',
          confidence: 'medium',
        };
      }

      // Account matched but no open opportunities
      return {
        opportunityId: null,
        accountId: account.id,
        matchedBy: 'account_domain',
        confidence: 'low',
      };
    }
  }

  // No match found
  return {
    opportunityId: null,
    accountId: null,
    matchedBy: null,
    confidence: 'low',
  };
}

/**
 * Find a calendar event that matches the Gong call
 * Used to link synced calls to existing calendar events
 */
export async function findMatchingCalendarEvent(
  meetingDate: Date,
  participantEmails: string[],
  organizationId: string
): Promise<string | null> {
  // Look for calendar events within 30 minutes of the call start time
  const windowStart = new Date(meetingDate.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(meetingDate.getTime() + 30 * 60 * 1000);

  const calendarEvent = await prisma.calendarEvent.findFirst({
    where: {
      user: { organizationId },
      startTime: {
        gte: windowStart,
        lte: windowEnd,
      },
      // At least one attendee email matches
      attendees: {
        hasSome: participantEmails,
      },
    },
    orderBy: {
      // Prefer closer match
      startTime: 'asc',
    },
  });

  return calendarEvent?.id || null;
}

/**
 * Get the primary external participant email for a call
 * Used for later manual matching
 */
export function getPrimaryExternalEmail(parties: GongParty[]): string | null {
  const externalParties = parties
    .filter((p) => p.context === 'External' && p.emailAddress)
    .sort((a, b) => {
      // Prefer parties with speakerId (actually spoke on the call)
      if (a.speakerId && !b.speakerId) return -1;
      if (!a.speakerId && b.speakerId) return 1;
      return 0;
    });

  return externalParties[0]?.emailAddress || null;
}
