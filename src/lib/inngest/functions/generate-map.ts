// src/lib/inngest/functions/generate-map.ts
// Inngest background job for generating Mutual Action Plans

import { inngest } from "@/lib/inngest/client";
import { generateMutualActionPlan } from "@/lib/ai/generate-mutual-action-plan";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import type { MAPGenerationContext, MAPActionItem } from "@/types/mutual-action-plan";
import { createId } from "@paralleldrive/cuid2";

/**
 * Background job that generates a Mutual Action Plan for an opportunity
 * Triggered when user clicks "Generate MAP" button
 */
export const generateMapJob = inngest.createFunction(
  {
    id: "generate-mutual-action-plan",
    name: "Generate Mutual Action Plan",
    retries: 3, // Auto-retry up to 3 times on failure
  },
  { event: "map/generate" },
  async ({ event, step }) => {
    const { mapId, opportunityId, templateContentId } = event.data;

    // Step 0: Set status to generating
    await step.run("set-generating-status", async () => {
      return await prisma.mutualActionPlan.update({
        where: { id: mapId },
        data: { generationStatus: "generating" },
      });
    });

    // Step 1: Fetch opportunity with all required context
    const opportunityContext = await step.run(
      "fetch-opportunity-context",
      async () => {
        const opportunity = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          select: {
            id: true,
            name: true,
            accountName: true,
            stage: true,
            closeDate: true,
            account: {
              select: {
                name: true,
              },
            },
            contacts: {
              select: {
                firstName: true,
                lastName: true,
                title: true,
                role: true,
              },
              take: 20, // Limit contacts for context
            },
            gongCalls: {
              where: {
                parsingStatus: ParsingStatus.completed,
              },
              select: {
                id: true,
                title: true,
                meetingDate: true,
                nextSteps: true,
              },
              orderBy: { meetingDate: "desc" },
              take: 10,
            },
            granolaNotes: {
              where: {
                parsingStatus: ParsingStatus.completed,
              },
              select: {
                id: true,
                title: true,
                meetingDate: true,
                nextSteps: true,
              },
              orderBy: { meetingDate: "desc" },
              take: 10,
            },
            googleNotes: {
              select: {
                id: true,
                title: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            calendarEvents: {
              where: {
                startTime: { lte: new Date() }, // Past events only
              },
              select: {
                id: true,
                summary: true,
                startTime: true,
              },
              orderBy: { startTime: "desc" },
              take: 10,
            },
          },
        });

        if (!opportunity) {
          throw new Error(`Opportunity not found: ${opportunityId}`);
        }

        return opportunity;
      }
    );

    // Step 2: Fetch template content if provided
    const templateBody = await step.run("fetch-template", async () => {
      if (!templateContentId) {
        return null;
      }

      const template = await prisma.content.findUnique({
        where: { id: templateContentId },
        select: { body: true },
      });

      return template?.body || null;
    });

    // Step 3: Build generation context
    const generationContext: MAPGenerationContext = await step.run(
      "build-generation-context",
      async () => {
        // Combine all meetings
        const meetings: MAPGenerationContext["meetings"] = [];

        // Add Gong calls
        opportunityContext.gongCalls.forEach((call) => {
          meetings.push({
            title: call.title,
            date: new Date(call.meetingDate).toISOString(),
            type: "gong",
            nextSteps: (call.nextSteps as string[]) || undefined,
          });
        });

        // Add Granola notes
        opportunityContext.granolaNotes.forEach((note) => {
          meetings.push({
            title: note.title,
            date: new Date(note.meetingDate).toISOString(),
            type: "granola",
            nextSteps: (note.nextSteps as string[]) || undefined,
          });
        });

        // Add Google notes
        opportunityContext.googleNotes.forEach((note) => {
          meetings.push({
            title: note.title,
            date: new Date(note.createdAt).toISOString(),
            type: "google",
          });
        });

        // Add calendar events (if not already covered by other sources)
        opportunityContext.calendarEvents.forEach((event) => {
          // Only add if we don't have a note from this meeting already
          const eventDate = new Date(event.startTime).toISOString().split("T")[0];
          const hasMeetingNote = meetings.some((m) => {
            const noteDate = new Date(m.date).toISOString().split("T")[0];
            return noteDate === eventDate;
          });

          if (!hasMeetingNote) {
            meetings.push({
              title: event.summary || "Meeting",
              date: new Date(event.startTime).toISOString(),
              type: "calendar",
            });
          }
        });

        // Sort meetings by date (newest first)
        meetings.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Build contacts list
        const contacts = opportunityContext.contacts.map((c) => ({
          name: `${c.firstName} ${c.lastName}`.trim(),
          title: c.title || undefined,
          role: c.role,
        }));

        return {
          opportunityId: opportunityContext.id,
          opportunityName: opportunityContext.name,
          accountName:
            opportunityContext.account?.name ||
            opportunityContext.accountName ||
            undefined,
          stage: opportunityContext.stage,
          closeDate: opportunityContext.closeDate
            ? new Date(opportunityContext.closeDate).toISOString().split("T")[0]
            : undefined,
          contacts,
          meetings,
          templateBody: templateBody || undefined,
        };
      }
    );

    // Step 4: Generate MAP using AI
    const generationResult = await step.run("generate-map-ai", async () => {
      const result = await generateMutualActionPlan(generationContext);
      return result;
    });

    // Step 5: Handle generation result
    if (!generationResult.success || !generationResult.data) {
      await step.run("set-failed-status", async () => {
        return await prisma.mutualActionPlan.update({
          where: { id: mapId },
          data: {
            generationStatus: "failed",
            generationError:
              generationResult.error || "Unknown error during generation",
          },
        });
      });

      throw new Error(`MAP generation failed: ${generationResult.error}`);
    }

    // Step 6: Add IDs and order to action items
    const actionItemsWithIds: MAPActionItem[] = generationResult.data.actionItems.map(
      (item, index) => ({
        ...item,
        id: createId(),
        order: index,
      })
    );

    // Step 7: Save generated MAP
    const updatedMap = await step.run("save-generated-map", async () => {
      return await prisma.mutualActionPlan.update({
        where: { id: mapId },
        data: {
          title: generationResult.data!.title,
          actionItems: JSON.parse(JSON.stringify(actionItemsWithIds)),
          generationStatus: "completed",
          generatedAt: new Date(),
          sourceCallCount:
            generationContext.meetings.filter(
              (m) => m.type === "gong" || m.type === "granola"
            ).length,
          templateContentId: templateContentId || null,
          generationError: null,
        },
        select: {
          id: true,
          title: true,
          generationStatus: true,
          generatedAt: true,
          sourceCallCount: true,
        },
      });
    });

    return {
      success: true,
      mapId: updatedMap.id,
      opportunityId,
      title: updatedMap.title,
      actionItemsCount: actionItemsWithIds.length,
      meetingsUsed: generationContext.meetings.length,
      templateUsed: !!templateContentId,
      generatedAt: updatedMap.generatedAt,
    };
  }
);
