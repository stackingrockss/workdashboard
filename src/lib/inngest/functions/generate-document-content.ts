// src/lib/inngest/functions/generate-document-content.ts
// Inngest background job for generating AI content for Document records

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { aggregateContext } from "@/lib/ai/context-aggregator";
import { generateBriefContent } from "@/lib/ai/brief-generator";
import { ContextSelectionInput } from "@/lib/validations/brief";
import { BriefSection } from "@/types/brief";

interface DocumentGenerateEventData {
  documentId: string;
  opportunityId: string;
  briefId: string;
  contextSelection: ContextSelectionInput;
  userId: string;
  organizationId: string;
}

/**
 * Background job that generates content for a Document using a brief template
 * Triggered when user clicks "Generate" button in the brief wizard
 * This is the unified document generation handler for the Document table
 */
export const generateDocumentContentJob = inngest.createFunction(
  {
    id: "generate-document-content",
    name: "Generate Document Content",
    retries: 3, // Auto-retry up to 3 times on failure
  },
  { event: "document/generate-content" },
  async ({ event, step }) => {
    const {
      documentId,
      opportunityId,
      briefId,
      contextSelection,
    } = event.data as DocumentGenerateEventData;

    // Step 0: Set status to generating
    await step.run("set-generating-status", async () => {
      return await prisma.document.update({
        where: { id: documentId },
        data: { generationStatus: "generating" },
      });
    });

    // Step 1: Fetch the brief
    const brief = await step.run("fetch-brief", async () => {
      const b = await prisma.contentBrief.findUnique({
        where: { id: briefId },
        select: {
          id: true,
          name: true,
          systemInstruction: true,
          outputFormat: true,
          sections: true,
        },
      });

      if (!b) {
        throw new Error(`Brief not found: ${briefId}`);
      }

      return b;
    });

    // Step 2: Aggregate context from selected sources
    const aggregatedContext = await step.run("aggregate-context", async () => {
      return await aggregateContext(opportunityId, contextSelection);
    });

    // Step 3: Generate content using AI
    const generationResult = await step.run("generate-content-ai", async () => {
      const result = await generateBriefContent(
        {
          name: brief.name,
          systemInstruction: brief.systemInstruction,
          outputFormat: brief.outputFormat,
          sections: brief.sections as unknown as BriefSection[],
        },
        aggregatedContext
      );
      return result;
    });

    // Step 4: Handle generation result
    if (!generationResult.success || !generationResult.content) {
      await step.run("set-failed-status", async () => {
        return await prisma.document.update({
          where: { id: documentId },
          data: {
            generationStatus: "failed",
            generationError:
              generationResult.error || "Unknown error during generation",
          },
        });
      });

      throw new Error(
        `Content generation failed: ${generationResult.error}`
      );
    }

    // Step 5: Save generated content
    const updatedDocument = await step.run("save-generated-content", async () => {
      return await prisma.document.update({
        where: { id: documentId },
        data: {
          content: generationResult.content!,
          generationStatus: "completed",
          generatedAt: new Date(),
          generationError: null,
        },
        select: {
          id: true,
          title: true,
          version: true,
          generationStatus: true,
          generatedAt: true,
        },
      });
    });

    // Step 6: Increment brief usage count
    await step.run("increment-usage-count", async () => {
      return await prisma.contentBrief.update({
        where: { id: briefId },
        data: { usageCount: { increment: 1 } },
      });
    });

    return {
      success: true,
      documentId: updatedDocument.id,
      opportunityId,
      briefId,
      title: updatedDocument.title,
      version: updatedDocument.version,
      generatedAt: updatedDocument.generatedAt,
      contextSources: {
        gongCalls: contextSelection.gongCallIds?.length || 0,
        granolaNotes: contextSelection.granolaNoteIds?.length || 0,
        googleNotes: contextSelection.googleNoteIds?.length || 0,
        accountResearch: contextSelection.includeAccountResearch || false,
        consolidatedInsights: contextSelection.includeConsolidatedInsights || false,
        hasAdditionalContext: !!contextSelection.additionalContext,
      },
    };
  }
);
