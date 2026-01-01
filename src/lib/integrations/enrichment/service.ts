/**
 * Contact Enrichment Service
 *
 * Orchestrates contact enrichment from calendar events.
 * Handles:
 * - Extracting attendees from calendar events
 * - Filtering internal/already-enriched contacts
 * - Calling the enrichment provider
 * - Creating/updating contact records
 * - Logging API usage
 */

import { prisma } from "@/lib/db";
import { EnrichmentProvider, EnrichedContactData, EnrichmentProviderType } from "./types";
import { createHunterClient } from "@/lib/integrations/hunter";
import { classifyContactRole } from "@/lib/ai/classify-contact-role";

export interface EnrichContactsFromMeetingResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  contacts: Array<{
    email: string;
    status: "created" | "updated" | "skipped" | "failed";
    contactId?: string;
    error?: string;
  }>;
}

/**
 * Get the configured enrichment provider
 * Currently supports Hunter.io, with abstraction for future providers
 */
function getEnrichmentProvider(providerType: EnrichmentProviderType = "hunter"): EnrichmentProvider {
  switch (providerType) {
    case "hunter":
      return createHunterClient();
    case "pdl":
      // Future: return createPeopleDataLabsClient();
      throw new Error("People Data Labs provider not yet implemented");
    default:
      throw new Error(`Unknown enrichment provider: ${providerType}`);
  }
}

/**
 * Extract external attendee emails from a calendar event
 */
async function getExternalAttendees(
  calendarEventId: string,
  organizationDomain: string
): Promise<string[]> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: calendarEventId },
    select: { attendees: true },
  });

  if (!event || !event.attendees.length) {
    return [];
  }

  // Filter out internal domain emails
  const normalizedOrgDomain = organizationDomain.toLowerCase().replace(/^www\./, "");

  return event.attendees.filter((email) => {
    const emailDomain = email.split("@")[1]?.toLowerCase().replace(/^www\./, "");
    if (!emailDomain) return false;

    // Exclude internal emails
    if (emailDomain === normalizedOrgDomain || emailDomain.endsWith(`.${normalizedOrgDomain}`)) {
      return false;
    }

    return true;
  });
}

/**
 * Find existing contacts by email to avoid duplicates
 */
async function findExistingContactsByEmail(
  emails: string[],
  opportunityId: string
): Promise<Map<string, { id: string; enrichmentStatus: string }>> {
  const contacts = await prisma.contact.findMany({
    where: {
      email: { in: emails },
      opportunityId,
    },
    select: {
      id: true,
      email: true,
      enrichmentStatus: true,
    },
  });

  const map = new Map<string, { id: string; enrichmentStatus: string }>();
  for (const contact of contacts) {
    if (contact.email) {
      map.set(contact.email.toLowerCase(), {
        id: contact.id,
        enrichmentStatus: contact.enrichmentStatus,
      });
    }
  }
  return map;
}

/**
 * Parse a name into first and last name
 */
function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Enrich contacts from a calendar event and create/update contact records
 */
export async function enrichContactsFromMeeting(
  calendarEventId: string,
  opportunityId: string,
  organizationId: string,
  options?: {
    provider?: EnrichmentProviderType;
    skipAlreadyEnriched?: boolean;
  }
): Promise<EnrichContactsFromMeetingResult> {
  const result: EnrichContactsFromMeetingResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    contacts: [],
  };

  // Get organization domain
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { domain: true },
  });

  if (!organization?.domain) {
    result.errors.push("Organization domain not configured");
    return result;
  }

  // Get external attendees
  const attendeeEmails = await getExternalAttendees(calendarEventId, organization.domain);
  if (attendeeEmails.length === 0) {
    return result;
  }

  // Find existing contacts
  const existingContacts = await findExistingContactsByEmail(attendeeEmails, opportunityId);

  // Filter emails to enrich
  const emailsToEnrich: string[] = [];
  for (const email of attendeeEmails) {
    const existing = existingContacts.get(email.toLowerCase());

    if (existing) {
      // Skip if already enriched (unless we want to re-enrich)
      if (
        options?.skipAlreadyEnriched !== false &&
        existing.enrichmentStatus === "enriched"
      ) {
        result.skipped++;
        result.contacts.push({
          email,
          status: "skipped",
          contactId: existing.id,
        });
        continue;
      }
    }

    emailsToEnrich.push(email);
  }

  if (emailsToEnrich.length === 0) {
    return result;
  }

  // Get enrichment provider
  const provider = getEnrichmentProvider(options?.provider || "hunter");

  // Enrich each email
  for (const email of emailsToEnrich) {
    result.processed++;

    try {
      // Mark as pending in existing contact or prepare for creation
      const existing = existingContacts.get(email.toLowerCase());

      // Call enrichment API
      const enrichResult = await provider.enrichPerson(email);

      // Log the API call
      await prisma.enrichmentLog.create({
        data: {
          organizationId,
          contactId: existing?.id || null,
          email,
          provider: provider.name,
          status: enrichResult.success ? "success" : enrichResult.error === "Person not found" ? "not_found" : "error",
          creditsUsed: enrichResult.creditsUsed,
          responseData: enrichResult.data as object || null,
          errorMessage: enrichResult.error || null,
        },
      });

      if (!enrichResult.success) {
        // Update existing contact status if applicable
        if (existing) {
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              enrichmentStatus: enrichResult.error === "Person not found" ? "not_found" : "failed",
              enrichmentSource: provider.name,
            },
          });
          result.contacts.push({
            email,
            status: "failed",
            contactId: existing.id,
            error: enrichResult.error,
          });
        } else {
          result.contacts.push({
            email,
            status: "failed",
            error: enrichResult.error,
          });
        }
        result.failed++;
        continue;
      }

      // We have enriched data - create or update contact
      const enrichedData = enrichResult.data!;
      const contactData = await buildContactData(enrichedData, provider.name);

      if (existing) {
        // Update existing contact
        await prisma.contact.update({
          where: { id: existing.id },
          data: contactData,
        });
        result.updated++;
        result.contacts.push({
          email,
          status: "updated",
          contactId: existing.id,
        });
      } else {
        // Create new contact
        const newContact = await prisma.contact.create({
          data: {
            ...contactData,
            opportunityId,
          },
        });
        result.created++;
        result.contacts.push({
          email,
          status: "created",
          contactId: newContact.id,
        });
      }
    } catch (error) {
      console.error(`[Enrichment] Error enriching ${email}:`, error);
      result.failed++;
      result.errors.push(`${email}: ${error instanceof Error ? error.message : "Unknown error"}`);
      result.contacts.push({
        email,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}

/**
 * Build contact data from enriched data
 */
async function buildContactData(
  enrichedData: EnrichedContactData,
  providerName: string
): Promise<{
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  linkedinUrl?: string;
  bio?: string;
  avatarUrl?: string;
  seniority?: string;
  company?: string;
  enrichedAt: Date;
  enrichmentSource: string;
  enrichmentStatus: "enriched";
  role: "decision_maker" | "influencer" | "champion" | "blocker" | "end_user";
}> {
  // Parse name
  let firstName = enrichedData.firstName || "";
  let lastName = enrichedData.lastName || "";

  if (!firstName && !lastName && enrichedData.fullName) {
    const parsed = parseFullName(enrichedData.fullName);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  }

  // If still no name, use email prefix
  if (!firstName && !lastName) {
    const emailPrefix = enrichedData.email.split("@")[0];
    firstName = emailPrefix;
    lastName = "";
  }

  // Classify role based on title
  let role: "decision_maker" | "influencer" | "champion" | "blocker" | "end_user" = "end_user";
  if (enrichedData.title) {
    try {
      const classification = await classifyContactRole(enrichedData.title);
      if (classification.role) {
        role = classification.role;
      }
    } catch (error) {
      console.warn("[Enrichment] Failed to classify role:", error);
    }
  }

  return {
    firstName,
    lastName,
    email: enrichedData.email,
    title: enrichedData.title || undefined,
    linkedinUrl: enrichedData.linkedinUrl || undefined,
    bio: enrichedData.bio || undefined,
    avatarUrl: enrichedData.avatarUrl || undefined,
    seniority: enrichedData.seniority || undefined,
    company: enrichedData.company || undefined,
    enrichedAt: new Date(),
    enrichmentSource: providerName,
    enrichmentStatus: "enriched",
    role,
  };
}

/**
 * Enrich a single contact by email
 * Used for manual enrichment of individual contacts
 */
export async function enrichSingleContact(
  contactId: string,
  organizationId: string,
  options?: {
    provider?: EnrichmentProviderType;
    forceRefresh?: boolean;
  }
): Promise<{
  success: boolean;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    title?: string | null;
    linkedinUrl?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    seniority?: string | null;
    company?: string | null;
    enrichmentStatus: string;
  };
  error?: string;
}> {
  // Get the contact
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      email: true,
      enrichmentStatus: true,
      opportunity: {
        select: {
          organizationId: true,
        },
      },
      account: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!contact) {
    return { success: false, error: "Contact not found" };
  }

  // Verify organization access
  const contactOrgId = contact.opportunity?.organizationId || contact.account?.organizationId;
  if (contactOrgId !== organizationId) {
    return { success: false, error: "Access denied" };
  }

  if (!contact.email) {
    return { success: false, error: "Contact has no email address" };
  }

  // Skip if already enriched (unless forcing refresh)
  if (!options?.forceRefresh && contact.enrichmentStatus === "enriched") {
    return { success: false, error: "Contact already enriched" };
  }

  // Get enrichment provider
  const provider = getEnrichmentProvider(options?.provider || "hunter");

  try {
    // Mark as pending
    await prisma.contact.update({
      where: { id: contactId },
      data: { enrichmentStatus: "pending" },
    });

    // Call enrichment API
    const enrichResult = await provider.enrichPerson(contact.email);

    // Log the API call
    await prisma.enrichmentLog.create({
      data: {
        organizationId,
        contactId,
        email: contact.email,
        provider: provider.name,
        status: enrichResult.success ? "success" : enrichResult.error === "Person not found" ? "not_found" : "error",
        creditsUsed: enrichResult.creditsUsed,
        responseData: enrichResult.data as object || null,
        errorMessage: enrichResult.error || null,
      },
    });

    if (!enrichResult.success) {
      const status = enrichResult.error === "Person not found" ? "not_found" : "failed";
      const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: {
          enrichmentStatus: status,
          enrichmentSource: provider.name,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          linkedinUrl: true,
          bio: true,
          avatarUrl: true,
          seniority: true,
          company: true,
          enrichmentStatus: true,
        },
      });

      return {
        success: false,
        contact: updatedContact,
        error: enrichResult.error,
      };
    }

    // Build update data from enriched results
    const enrichedData = enrichResult.data!;
    const updateData = await buildContactData(enrichedData, provider.name);

    // Update the contact (only update fields we got from enrichment, don't overwrite existing name)
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        title: updateData.title || undefined,
        linkedinUrl: updateData.linkedinUrl || undefined,
        bio: updateData.bio || undefined,
        avatarUrl: updateData.avatarUrl || undefined,
        seniority: updateData.seniority || undefined,
        company: updateData.company || undefined,
        enrichedAt: updateData.enrichedAt,
        enrichmentSource: updateData.enrichmentSource,
        enrichmentStatus: updateData.enrichmentStatus,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        title: true,
        linkedinUrl: true,
        bio: true,
        avatarUrl: true,
        seniority: true,
        company: true,
        enrichmentStatus: true,
      },
    });

    return { success: true, contact: updatedContact };
  } catch (error) {
    console.error(`[Enrichment] Error enriching contact ${contactId}:`, error);

    // Mark as failed
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        enrichmentStatus: "failed",
        enrichmentSource: provider.name,
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Enrich all unenriched contacts for an opportunity
 */
export async function enrichOpportunityContacts(
  opportunityId: string,
  organizationId: string,
  options?: {
    provider?: EnrichmentProviderType;
  }
): Promise<{
  processed: number;
  enriched: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Verify opportunity belongs to organization
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId,
    },
    select: { id: true },
  });

  if (!opportunity) {
    result.errors.push("Opportunity not found or access denied");
    return result;
  }

  // Get unenriched contacts with emails
  const contacts = await prisma.contact.findMany({
    where: {
      opportunityId,
      enrichmentStatus: "none",
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (contacts.length === 0) {
    return result;
  }

  // Enrich each contact
  for (const contact of contacts) {
    if (!contact.email) {
      result.skipped++;
      continue;
    }

    result.processed++;

    const enrichResult = await enrichSingleContact(contact.id, organizationId, options);

    if (enrichResult.success) {
      result.enriched++;
    } else if (enrichResult.error === "Person not found") {
      result.skipped++;
    } else {
      result.failed++;
      result.errors.push(`${contact.email}: ${enrichResult.error}`);
    }
  }

  return result;
}

/**
 * Get enrichment usage stats for an organization
 */
export async function getEnrichmentStats(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number;
  successfulEnrichments: number;
  notFoundCount: number;
  errorCount: number;
  totalCreditsUsed: number;
}> {
  const where: {
    organizationId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { organizationId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.enrichmentLog.findMany({
    where,
    select: {
      status: true,
      creditsUsed: true,
    },
  });

  return {
    totalCalls: logs.length,
    successfulEnrichments: logs.filter((l) => l.status === "success").length,
    notFoundCount: logs.filter((l) => l.status === "not_found").length,
    errorCount: logs.filter((l) => l.status === "error").length,
    totalCreditsUsed: logs.reduce((sum, l) => sum + l.creditsUsed, 0),
  };
}
