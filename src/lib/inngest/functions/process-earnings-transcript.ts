// src/lib/inngest/functions/process-earnings-transcript.ts
// Inngest background job for processing earnings call transcripts

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { TranscriptProcessingStatus } from "@prisma/client";
import {
  fetchTranscriptWithFallback,
  getSeekingAlphaTranscriptUrl,
} from "@/lib/integrations/api-ninjas";
import { parseEarningsTranscript } from "@/lib/ai/parse-earnings-transcript";

/**
 * Background job that fetches (if needed) and parses an earnings call transcript
 * Triggered when a new transcript is created or when retrying a failed process
 */
export const processEarningsTranscriptJob = inngest.createFunction(
  {
    id: "process-earnings-transcript",
    name: "Process Earnings Transcript",
    retries: 3,
  },
  { event: "earnings/transcript.process" },
  async ({ event, step }) => {
    const { transcriptId } = event.data;

    // Step 1: Update status to processing
    await step.run("update-status-processing", async () => {
      await prisma.earningsCallTranscript.update({
        where: { id: transcriptId },
        data: {
          processingStatus: TranscriptProcessingStatus.processing,
          processingError: null,
        },
      });
      return { status: "processing" };
    });

    // Step 2: Fetch transcript data
    const transcriptData = await step.run("fetch-transcript-data", async () => {
      const transcript = await prisma.earningsCallTranscript.findUnique({
        where: { id: transcriptId },
        include: { account: true },
      });

      if (!transcript) {
        throw new Error("Transcript not found");
      }

      return transcript;
    });

    // Step 3: Fetch transcript text (if not manually uploaded)
    let transcriptText = transcriptData.transcriptText;

    if (!transcriptText) {
      transcriptText = await step.run("fetch-transcript-from-api", async () => {
        // Get ticker from account
        const ticker = transcriptData.account.ticker;

        if (!ticker) {
          throw new Error(
            "Account ticker is required to fetch earnings transcript from API"
          );
        }

        // Parse quarter string (e.g., "Q1" -> 1)
        const quarterNum = parseInt(transcriptData.quarter.replace("Q", ""), 10);

        // Try API Ninjas (S&P 100 companies on free tier)
        const result = await fetchTranscriptWithFallback(
          ticker,
          transcriptData.fiscalYear,
          quarterNum
        );

        if (result.success && result.transcript) {
          // Save fetched transcript to database
          await prisma.earningsCallTranscript.update({
            where: { id: transcriptId },
            data: { transcriptText: result.transcript },
          });

          return result.transcript;
        }

        // Transcript not available via API - manual upload required
        const seekingAlphaUrl = getSeekingAlphaTranscriptUrl(ticker);
        throw new Error(
          `Transcript not available via API for ${ticker}. ` +
            `Please manually upload the transcript. ` +
            `You can find it at: ${seekingAlphaUrl}`
        );
      });
    }

    // Step 4: Parse transcript with Gemini AI
    const aiParsed = await step.run("parse-transcript", async () => {
      try {
        return await parseEarningsTranscript(transcriptText!);
      } catch (error) {
        throw new Error(
          `AI parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    });

    // Step 5: Save results to database
    await step.run("save-results", async () => {
      await prisma.earningsCallTranscript.update({
        where: { id: transcriptId },
        data: {
          keyQuotes: JSON.parse(JSON.stringify(aiParsed.keyQuotes)),
          revenueGuidance: JSON.parse(JSON.stringify(aiParsed.revenueGuidance)),
          productAnnouncements: JSON.parse(
            JSON.stringify(aiParsed.productAnnouncements)
          ),
          competitiveLandscape: aiParsed.competitiveLandscape,
          executiveSentiment: aiParsed.executiveSentiment,
          aiSummary: aiParsed.fullSummary,
          processedAt: new Date(),
          processingStatus: TranscriptProcessingStatus.completed,
        },
      });
    });

    return { success: true, transcriptId };
  }
);
