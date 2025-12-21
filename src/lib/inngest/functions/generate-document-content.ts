// src/lib/inngest/functions/generate-document-content.ts
// Inngest background job for generating AI content for Document records

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { aggregateContext } from "@/lib/ai/context-aggregator";
import { generateFrameworkContent } from "@/lib/ai/framework-generator";
import { ContextSelectionInput } from "@/lib/validations/framework";
import { FrameworkSection } from "@/types/framework";

interface DocumentGenerateEventData {
  documentId: string;
  opportunityId: string;
  frameworkId: string;
  contextSelection: ContextSelectionInput;
  userId: string;
  organizationId: string;
}

/**
 * Background job that generates content for a Document using a framework template
 * Triggered when user clicks "Generate" button in the framework wizard
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
      frameworkId,
      contextSelection,
    } = event.data as DocumentGenerateEventData;

    // Step 0: Set status to generating
    await step.run("set-generating-status", async () => {
      return await prisma.document.update({
        where: { id: documentId },
        data: { generationStatus: "generating" },
      });
    });

    // Step 1: Fetch the framework
    const framework = await step.run("fetch-framework", async () => {
      const fw = await prisma.contentFramework.findUnique({
        where: { id: frameworkId },
        select: {
          id: true,
          name: true,
          systemInstruction: true,
          outputFormat: true,
          sections: true,
        },
      });

      if (!fw) {
        throw new Error(`Framework not found: ${frameworkId}`);
      }

      return fw;
    });

    // Step 2: Aggregate context from selected sources
    const aggregatedContext = await step.run("aggregate-context", async () => {
      return await aggregateContext(opportunityId, contextSelection);
    });

    // Step 3: Generate content using AI
    const generationResult = await step.run("generate-content-ai", async () => {
      const result = await generateFrameworkContent(
        {
          name: framework.name,
          systemInstruction: framework.systemInstruction,
          outputFormat: framework.outputFormat,
          sections: framework.sections as unknown as FrameworkSection[],
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

    // Step 6: Increment framework usage count
    await step.run("increment-usage-count", async () => {
      return await prisma.contentFramework.update({
        where: { id: frameworkId },
        data: { usageCount: { increment: 1 } },
      });
    });

    return {
      success: true,
      documentId: updatedDocument.id,
      opportunityId,
      frameworkId,
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
