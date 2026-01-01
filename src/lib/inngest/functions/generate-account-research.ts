// src/lib/inngest/functions/generate-account-research.ts
// Inngest background job for generating AI account research on opportunity creation

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { AccountResearchStatus, BriefCategory } from "@prisma/client";
import { broadcastNotificationEvent } from "@/lib/realtime";
import { generateWithSystemInstruction } from "@/lib/ai/gemini";
import { getTemplateBriefByName } from "@/lib/briefs/template-briefs";
import { ContentBrief, BriefSection, ContextConfig } from "@/types/brief";

/**
 * Event data for account research generation
 */
export interface GenerateAccountResearchEventData {
  opportunityId: string;
  accountName: string;
  companyWebsite?: string;
  stage?: string;
  opportunityValue?: number;
  briefId?: string; // Optional: override default brief for this research
}

/**
 * Resolves the brief to use for account research generation.
 * Priority: 1) Explicit briefId, 2) Opportunity's briefId, 3) Org default, 4) Template fallback
 */
async function resolveBrief(
  opportunityId: string,
  organizationId: string,
  explicitBriefId?: string
): Promise<ContentBrief> {
  // 1. If explicit briefId provided, use it
  if (explicitBriefId) {
    const brief = await prisma.contentBrief.findUnique({
      where: { id: explicitBriefId },
    });
    if (brief) {
      return {
        ...brief,
        scope: brief.scope as ContentBrief["scope"],
        category: brief.category as ContentBrief["category"],
        sections: brief.sections as unknown as BriefSection[],
        contextConfig: brief.contextConfig as unknown as ContextConfig | null,
      };
    }
  }

  // 2. Check if opportunity has a specific brief assigned
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { accountResearchBriefId: true },
  });

  if (opportunity?.accountResearchBriefId) {
    const brief = await prisma.contentBrief.findUnique({
      where: { id: opportunity.accountResearchBriefId },
    });
    if (brief) {
      return {
        ...brief,
        scope: brief.scope as ContentBrief["scope"],
        category: brief.category as ContentBrief["category"],
        sections: brief.sections as unknown as BriefSection[],
        contextConfig: brief.contextConfig as unknown as ContextConfig | null,
      };
    }
  }

  // 3. Look for org's default account research brief
  const orgDefaultBrief = await prisma.contentBrief.findFirst({
    where: {
      organizationId,
      category: BriefCategory.account_research,
      isDefault: true,
    },
  });

  if (orgDefaultBrief) {
    return {
      ...orgDefaultBrief,
      scope: orgDefaultBrief.scope as ContentBrief["scope"],
      category: orgDefaultBrief.category as ContentBrief["category"],
      sections: orgDefaultBrief.sections as unknown as BriefSection[],
      contextConfig: orgDefaultBrief.contextConfig as unknown as ContextConfig | null,
    };
  }

  // 4. Fall back to template brief
  const templateBrief = getTemplateBriefByName("Account Research");
  if (templateBrief) {
    return templateBrief;
  }

  // This should never happen, but throw if no brief found
  throw new Error("No account research brief found");
}

/**
 * Builds the user prompt for account research generation
 */
function buildAccountResearchPrompt(
  brief: ContentBrief,
  accountName: string,
  companyWebsite?: string,
  stage?: string,
  opportunityValue?: number
): string {
  const sectionGuide = brief.sections
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}**${s.required ? " (Required)" : ""}${s.description ? `: ${s.description}` : ""}`
    )
    .join("\n");

  return `Generate comprehensive pre-meeting sales intelligence for an enterprise sales call with: ${accountName}

${companyWebsite ? `Company Website: ${companyWebsite}\nUse the company website to gather accurate, current information about their products, services, and positioning.\n` : ""}
${stage ? `Opportunity Stage: ${stage}` : ""}
${opportunityValue ? `Estimated Deal Value: $${opportunityValue.toLocaleString()}` : ""}

Please research and provide the following sections:
${sectionGuide}

---

**Research Instructions:**
- Prioritize recent, factual information
- If exact data isn't available, provide educated estimates with caveats
- Focus on industry-specific intelligence relevant to the sales conversation
- Highlight timing factors that make this a good time to engage
- Be specific about how your solutions map to their challenges

Generate comprehensive, actionable intelligence that prepares the sales rep for a consultative, value-driven conversation.`;
}

/**
 * Generates account research using a brief's system instruction
 */
async function generateAccountResearchWithBrief(
  brief: ContentBrief,
  accountName: string,
  companyWebsite?: string,
  stage?: string,
  opportunityValue?: number
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const prompt = buildAccountResearchPrompt(
      brief,
      accountName,
      companyWebsite,
      stage,
      opportunityValue
    );

    // Build system instruction with output format if provided
    let systemInstruction = brief.systemInstruction;
    if (brief.outputFormat) {
      systemInstruction += `\n\n## Output Format\n${brief.outputFormat}`;
    }

    const result = await generateWithSystemInstruction(
      prompt,
      systemInstruction,
      "gemini-3-pro-preview",
      3 // Standard 3 retries
    );

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, content: result.text };
  } catch (error) {
    console.error("Error generating account research with brief:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Background job that generates AI-powered account research for an opportunity
 * Triggered when a new opportunity is created with an account name
 *
 * Uses Inngest for reliable background processing with:
 * - Automatic retries on failure
 * - Status tracking (generating -> completed/failed)
 * - Timeout handling for long-running AI calls
 * - Brief-based prompt configuration
 */
export const generateAccountResearchJob = inngest.createFunction(
  {
    id: "generate-account-research",
    name: "Generate Account Research",
    retries: 2, // Retry twice on failure (3 total attempts)
  },
  { event: "opportunity/research.generate" },
  async ({ event, step }) => {
    const { opportunityId, accountName, companyWebsite, stage, opportunityValue, briefId } =
      event.data as GenerateAccountResearchEventData;

    // Step 1: Update status to 'generating' and get organizationId
    const opportunityData = await step.run("update-status-generating", async () => {
      const updated = await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { accountResearchStatus: AccountResearchStatus.generating },
        select: { organizationId: true },
      });
      return { status: "generating", organizationId: updated.organizationId };
    });

    // Step 2: Resolve which brief to use
    const brief = await step.run("resolve-brief", async () => {
      return await resolveBrief(opportunityId, opportunityData.organizationId, briefId);
    });

    // Step 3: Generate AI research using brief system
    const result = await step.run("generate-research", async () => {
      return await generateAccountResearchWithBrief(
        brief,
        accountName,
        companyWebsite,
        stage,
        opportunityValue
      );
    });

    // Step 4: Handle result and update opportunity
    if (result.success && result.content) {
      const updatedOpportunity = await step.run("save-research-success", async () => {
        return await prisma.opportunity.update({
          where: { id: opportunityId },
          data: {
            accountResearch: result.content,
            accountResearchGeneratedAt: new Date(),
            accountResearchStatus: AccountResearchStatus.completed,
          },
          select: {
            id: true,
            name: true,
            ownerId: true,
            organizationId: true,
            accountName: true,
          },
        });
      });

      // Step 5: Create notification and broadcast
      await step.run("create-research-notification", async () => {
        try {
          // Check if notification already exists (idempotency)
          const existingNotification = await prisma.accountResearchNotification.findUnique({
            where: { opportunityId: opportunityId },
          });

          if (existingNotification) {
            return { notificationCreated: false, reason: "notification already exists" };
          }

          // Create notification record
          const notification = await prisma.accountResearchNotification.create({
            data: {
              userId: updatedOpportunity.ownerId,
              organizationId: updatedOpportunity.organizationId,
              opportunityId: updatedOpportunity.id,
              opportunityName: updatedOpportunity.name,
              accountName: updatedOpportunity.accountName || accountName,
            },
          });

          // Broadcast real-time notification
          await broadcastNotificationEvent(updatedOpportunity.ownerId, {
            type: "research:complete",
            payload: {
              notificationId: notification.id,
              opportunityId: updatedOpportunity.id,
              opportunityName: updatedOpportunity.name,
              accountName: updatedOpportunity.accountName || accountName,
            },
          });

          return { notificationCreated: true, notificationId: notification.id };
        } catch (error) {
          // Log but don't fail the job if notification creation fails
          console.error("Failed to create account research notification:", error);
          return { notificationCreated: false, error: String(error) };
        }
      });

      return {
        success: true,
        opportunityId,
        accountName,
        briefId: brief.id,
        researchLength: result.content?.length || 0,
      };
    } else {
      // Mark as failed
      await step.run("save-research-failed", async () => {
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { accountResearchStatus: AccountResearchStatus.failed },
        });
      });

      throw new Error(`Research generation failed: ${result.error || "Unknown error"}`);
    }
  }
);

/**
 * Trigger account research generation via Inngest
 * Call this from API routes to queue the background job
 */
export async function triggerAccountResearchGeneration(data: GenerateAccountResearchEventData): Promise<void> {
  await inngest.send({
    name: "opportunity/research.generate",
    data,
  });
}
