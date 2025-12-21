// src/lib/inngest/functions/generate-framework-content.ts
// Inngest background job for generating AI content using frameworks

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { aggregateContext } from "@/lib/ai/context-aggregator";
import { generateFrameworkContent } from "@/lib/ai/framework-generator";
import { ContextSelectionInput } from "@/lib/validations/framework";
import { FrameworkSection } from "@/types/framework";

interface FrameworkGenerateEventData {
  generatedContentId: string;
  opportunityId: string;
  frameworkId: string;
  contextSelection: ContextSelectionInput;
  userId: string;
  organizationId: string;
}

/**
 * Background job that generates content using a framework template
 * Triggered when user clicks "Generate" button in the framework wizard
 */
export const generateFrameworkContentJob = inngest.createFunction(
  {
    id: "generate-framework-content",
    name: "Generate Framework Content",
    retries: 3, // Auto-retry up to 3 times on failure
  },
  { event: "framework/generate" },
  async ({ event, step }) => {
    const {
      generatedContentId,
      opportunityId,
      frameworkId,
      contextSelection,
    } = event.data as FrameworkGenerateEventData;

    // Step 0: Set status to generating
    await step.run("set-generating-status", async () => {
      return await prisma.generatedContent.update({
        where: { id: generatedContentId },
        data: { generationStatus: "generating" },
      });
    });

    // Step 1: Fetch the framework (brief)
    const framework = await step.run("fetch-framework", async () => {
      const fw = await prisma.contentBrief.findUnique({
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
        return await prisma.generatedContent.update({
          where: { id: generatedContentId },
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
    const updatedContent = await step.run("save-generated-content", async () => {
      return await prisma.generatedContent.update({
        where: { id: generatedContentId },
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
      return await prisma.contentBrief.update({
        where: { id: frameworkId },
        data: { usageCount: { increment: 1 } },
      });
    });

    return {
      success: true,
      generatedContentId: updatedContent.id,
      opportunityId,
      frameworkId,
      title: updatedContent.title,
      version: updatedContent.version,
      generatedAt: updatedContent.generatedAt,
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
