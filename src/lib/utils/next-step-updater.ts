import { prisma } from "@/lib/db";

/**
 * Updates an opportunity's nextStep field from the most recent call's nextSteps array.
 *
 * Priority rules:
 * 1. Most recent call by meetingDate wins
 * 2. If both Gong and Granola exist on the same day, prefer Gong
 * 3. All next steps are joined with newlines (not just the first)
 *
 * @param opportunityId - The ID of the opportunity to update
 * @returns Object with updated flag and the new nextStep value
 */
export async function updateOpportunityNextStep(
  opportunityId: string
): Promise<{ updated: boolean; nextStep: string | null }> {
  try {
    // Find latest Gong call with completed parsing
    const latestGong = await prisma.gongCall.findFirst({
      where: {
        opportunityId,
        parsingStatus: "completed",
      },
      orderBy: { meetingDate: "desc" },
      select: { meetingDate: true, nextSteps: true },
    });

    // Find latest Granola note with completed parsing
    const latestGranola = await prisma.granolaNote.findFirst({
      where: {
        opportunityId,
        parsingStatus: "completed",
      },
      orderBy: { meetingDate: "desc" },
      select: { meetingDate: true, nextSteps: true },
    });

    // Helper to safely extract nextSteps array
    const extractNextSteps = (
      nextSteps: unknown
    ): string[] | null => {
      if (!nextSteps || !Array.isArray(nextSteps)) return null;
      return nextSteps as string[];
    };

    // Determine which source to use (prefer Gong if same day)
    let latestNextSteps: string[] | null = null;

    if (latestGong && latestGranola) {
      // Compare dates (ignoring time) to check if same day
      const gongDate = latestGong.meetingDate.toISOString().split("T")[0];
      const granolaDate = latestGranola.meetingDate.toISOString().split("T")[0];

      if (gongDate === granolaDate) {
        // Same day: prefer Gong (higher quality transcript)
        latestNextSteps = extractNextSteps(latestGong.nextSteps);
      } else {
        // Different days: use most recent
        latestNextSteps =
          latestGong.meetingDate > latestGranola.meetingDate
            ? extractNextSteps(latestGong.nextSteps)
            : extractNextSteps(latestGranola.nextSteps);
      }
    } else if (latestGong) {
      latestNextSteps = extractNextSteps(latestGong.nextSteps);
    } else if (latestGranola) {
      latestNextSteps = extractNextSteps(latestGranola.nextSteps);
    }

    // Format next steps as bullet points, or null if empty/no calls
    const nextStep =
      latestNextSteps && latestNextSteps.length > 0
        ? latestNextSteps.map((step) => `• ${step}`).join("\n")
        : null;

    // Update opportunity
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { nextStep },
    });

    return { updated: true, nextStep };
  } catch (error) {
    console.error("[next-step-updater] Failed to update nextStep:", error);
    return { updated: false, nextStep: null };
  }
}
