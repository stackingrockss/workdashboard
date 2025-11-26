// src/lib/inngest/functions/process-sec-filing.ts
// Inngest background job for processing SEC filings

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { FilingProcessingStatus } from "@prisma/client";
import {
  fetchSecFiling,
  extractFilingSections,
} from "@/lib/integrations/sec-edgar";
import { summarizeSecFiling } from "@/lib/ai/summarize-sec-filing";

/**
 * Background job that fetches, parses, and summarizes an SEC filing
 * Triggered when a new filing is created or when retrying a failed process
 */
export const processSecFilingJob = inngest.createFunction(
  {
    id: "process-sec-filing",
    name: "Process SEC Filing",
    retries: 3,
  },
  { event: "sec/filing.process" },
  async ({ event, step }) => {
    const { filingId } = event.data;

    // Step 1: Update status to processing
    await step.run("update-status-processing", async () => {
      await prisma.secFiling.update({
        where: { id: filingId },
        data: {
          processingStatus: FilingProcessingStatus.processing,
          processingError: null,
        },
      });
      return { status: "processing" };
    });

    // Step 2: Fetch filing data
    const filingData = await step.run("fetch-filing-data", async () => {
      const filing = await prisma.secFiling.findUnique({
        where: { id: filingId },
        include: { account: true },
      });

      if (!filing) {
        throw new Error("Filing not found");
      }

      return filing;
    });

    // Step 3: Fetch, extract, and summarize in a single step
    // Combined to avoid storing large HTML/section data in Inngest step outputs
    // (10-K filings can be 100+ pages, exceeding Inngest's output_too_large limit)
    const aiSummary = await step.run("fetch-extract-summarize", async () => {
      // Fetch HTML filing from SEC
      let htmlContent: string;
      try {
        htmlContent = await fetchSecFiling(
          filingData.cik,
          filingData.accessionNumber
        );
      } catch (error) {
        throw new Error(
          `Failed to fetch filing from SEC: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      // Extract key sections
      const sections = extractFilingSections(htmlContent);

      // Check if extraction was successful
      if (
        sections.business === "Extraction failed" ||
        sections.riskFactors === "Extraction failed"
      ) {
        await prisma.secFiling.update({
          where: { id: filingId },
          data: {
            processingStatus: FilingProcessingStatus.failed,
            processingError: "Failed to extract filing sections from HTML",
          },
        });
        throw new Error("Filing section extraction failed");
      }

      // Summarize with Gemini AI
      try {
        return await summarizeSecFiling(sections);
      } catch (error) {
        throw new Error(
          `AI summarization failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    });

    // Step 4: Save results to database
    await step.run("save-results", async () => {
      await prisma.secFiling.update({
        where: { id: filingId },
        data: {
          businessOverview: aiSummary.businessOverview,
          riskFactors: JSON.parse(JSON.stringify(aiSummary.riskFactors)),
          financialHighlights: JSON.parse(
            JSON.stringify(aiSummary.financialHighlights)
          ),
          strategicInitiatives: aiSummary.strategicInitiatives,
          aiSummary: aiSummary.fullSummary,
          processedAt: new Date(),
          processingStatus: FilingProcessingStatus.completed,
        },
      });
    });

    return { success: true, filingId };
  }
);
