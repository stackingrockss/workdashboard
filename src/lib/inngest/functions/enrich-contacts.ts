/**
 * Inngest Background Job: Contact Enrichment
 *
 * Triggered when a calendar event is linked to an opportunity.
 * Enriches external attendees using Hunter.io (or other providers).
 *
 * Flow:
 * 1. Fetch calendar event attendees
 * 2. Filter to external emails (exclude internal domain)
 * 3. Check for existing contacts (skip already enriched)
 * 4. Call enrichment API for each unique email
 * 5. Create Contact records with enriched data
 * 6. Log API usage for cost tracking
 * 7. Notify user of new contacts created
 */

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { enrichContactsFromMeeting } from "@/lib/integrations/enrichment/service";
import type { EnrichmentProviderType } from "@/lib/integrations/enrichment/types";

interface EnrichContactsEventData {
  calendarEventId: string;
  opportunityId: string;
  organizationId: string;
  userId: string;
  provider?: EnrichmentProviderType;
}

export const enrichContactsJob = inngest.createFunction(
  {
    id: "enrich-contacts",
    name: "Enrich Contacts from Meeting",
    retries: 2, // Auto-retry up to 2 times on failure
  },
  { event: "contacts/enrich.request" },
  async ({ event, step }) => {
    const {
      calendarEventId,
      opportunityId,
      organizationId,
      userId,
      provider = "hunter",
    } = event.data as EnrichContactsEventData;

    // Step 1: Validate the calendar event and opportunity exist
    const { calendarEvent, opportunity } = await step.run(
      "validate-event-and-opportunity",
      async () => {
        const [event, opp] = await Promise.all([
          prisma.calendarEvent.findUnique({
            where: { id: calendarEventId },
            select: {
              id: true,
              summary: true,
              attendees: true,
              opportunityId: true,
            },
          }),
          prisma.opportunity.findUnique({
            where: { id: opportunityId },
            select: {
              id: true,
              name: true,
              organizationId: true,
            },
          }),
        ]);

        if (!event) {
          throw new Error(`Calendar event not found: ${calendarEventId}`);
        }
        if (!opp) {
          throw new Error(`Opportunity not found: ${opportunityId}`);
        }
        if (opp.organizationId !== organizationId) {
          throw new Error("Opportunity does not belong to the specified organization");
        }

        return { calendarEvent: event, opportunity: opp };
      }
    );

    // Step 2: Check if there are external attendees
    const hasExternalAttendees = await step.run(
      "check-external-attendees",
      async () => {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { domain: true },
        });

        if (!org?.domain) {
          console.log("[EnrichContacts] Organization domain not configured, skipping");
          return false;
        }

        const normalizedDomain = org.domain.toLowerCase().replace(/^www\./, "");
        const externalAttendees = calendarEvent.attendees.filter((email) => {
          const emailDomain = email.split("@")[1]?.toLowerCase().replace(/^www\./, "");
          if (!emailDomain) return false;
          return emailDomain !== normalizedDomain && !emailDomain.endsWith(`.${normalizedDomain}`);
        });

        if (externalAttendees.length === 0) {
          console.log("[EnrichContacts] No external attendees found, skipping");
          return false;
        }

        console.log(`[EnrichContacts] Found ${externalAttendees.length} external attendees`);
        return true;
      }
    );

    if (!hasExternalAttendees) {
      return {
        status: "skipped",
        reason: "No external attendees found",
      };
    }

    // Step 3: Check if Hunter API key is configured
    const isProviderConfigured = await step.run(
      "check-provider-configured",
      async () => {
        if (provider === "hunter") {
          const hasApiKey = !!process.env.HUNTER_API_KEY;
          if (!hasApiKey) {
            console.warn("[EnrichContacts] HUNTER_API_KEY not configured");
          }
          return hasApiKey;
        }
        return false;
      }
    );

    if (!isProviderConfigured) {
      return {
        status: "skipped",
        reason: `${provider} API key not configured`,
      };
    }

    // Step 4: Enrich contacts
    const enrichmentResult = await step.run("enrich-contacts", async () => {
      return await enrichContactsFromMeeting(
        calendarEventId,
        opportunityId,
        organizationId,
        { provider, skipAlreadyEnriched: true }
      );
    });

    // Step 5: Log result summary
    console.log(
      `[EnrichContacts] Completed: ${enrichmentResult.created} created, ${enrichmentResult.updated} updated, ${enrichmentResult.skipped} skipped, ${enrichmentResult.failed} failed`
    );

    // Step 6: Create notification for user if contacts were created
    if (enrichmentResult.created > 0) {
      await step.run("create-notification", async () => {
        try {
          // We could create a ContactsEnrichedNotification here if needed
          // For now, we just log the success
          console.log(
            `[EnrichContacts] Created ${enrichmentResult.created} new contacts for opportunity ${opportunity.name}`
          );

          // Future: Could broadcast a real-time notification
          // await broadcastNotificationEvent(userId, {
          //   type: "contacts:enriched",
          //   payload: {
          //     opportunityId,
          //     opportunityName: opportunity.name,
          //     contactCount: enrichmentResult.created,
          //   },
          // });
        } catch (error) {
          console.error("[EnrichContacts] Failed to create notification:", error);
          // Don't fail the job for notification errors
        }
      });
    }

    return {
      status: "completed",
      processed: enrichmentResult.processed,
      created: enrichmentResult.created,
      updated: enrichmentResult.updated,
      skipped: enrichmentResult.skipped,
      failed: enrichmentResult.failed,
      errors: enrichmentResult.errors,
    };
  }
);
