import { prisma } from "@/lib/db";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";

/**
 * Context size configuration
 */
const MAX_CONTEXT_SIZE = 10000; // Target max characters for context
const MAX_GONG_CALLS = 5; // Most recent parsed Gong calls to include
const MAX_CALENDAR_EVENTS = 5; // Upcoming calendar events to include

/**
 * Build comprehensive context for opportunity chat
 * @param opportunityId - ID of the opportunity
 * @param organizationId - Organization ID for multi-tenant isolation
 * @returns Formatted context string
 */
export async function buildOpportunityContext(
  opportunityId: string,
  organizationId: string
): Promise<{ context: string; size: number }> {
  // Fetch comprehensive opportunity data
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId,
    },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      account: {
        select: {
          name: true,
          industry: true,
          website: true,
          health: true,
          ticker: true,
          notes: true,
        },
      },
      contacts: {
        select: {
          firstName: true,
          lastName: true,
          title: true,
          role: true,
          sentiment: true,
          notes: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      gongCalls: {
        where: {
          parsingStatus: "completed",
        },
        select: {
          id: true,
          title: true,
          meetingDate: true,
          painPoints: true,
          goals: true,
          nextSteps: true,
          riskAssessment: true,
          parsedAt: true,
        },
        orderBy: {
          meetingDate: "desc",
        },
        take: MAX_GONG_CALLS,
      },
      earningsTranscripts: {
        where: {
          processingStatus: "completed",
        },
        select: {
          quarter: true,
          fiscalYear: true,
          callDate: true,
          aiSummary: true,
          executiveSentiment: true,
          competitiveLandscape: true,
        },
        orderBy: {
          callDate: "desc",
        },
        take: 2, // Most recent 2 earnings calls
      },
      calendarEvents: {
        where: {
          startTime: {
            gte: new Date(),
          },
        },
        select: {
          summary: true,
          startTime: true,
          endTime: true,
          attendees: true,
        },
        orderBy: {
          startTime: "asc",
        },
        take: MAX_CALENDAR_EVENTS,
      },
    },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found");
  }

  // Build context sections
  const sections: string[] = [];

  // 1. Opportunity Overview
  sections.push(
    `# Opportunity: ${opportunity.name}`,
    ``,
    `## Overview`,
    `- **Account**: ${opportunity.account?.name || opportunity.accountName || "No account"}`,
    `- **Industry**: ${opportunity.account?.industry || "Unknown"}`,
    `- **ARR**: ${formatCurrencyCompact(opportunity.amountArr)}`,
    `- **Stage**: ${formatStage(opportunity.stage)}`,
    `- **Confidence Level**: ${opportunity.confidenceLevel}/5`,
    `- **Forecast Category**: ${opportunity.forecastCategory ? formatForecastCategory(opportunity.forecastCategory) : "Not set"}`,
    `- **Close Date**: ${opportunity.closeDate ? formatDateShort(opportunity.closeDate) : "Not set"}`,
    `- **Owner**: ${opportunity.owner.name || opportunity.owner.email}`,
    `- **Next Step**: ${opportunity.nextStep || "No next step defined"}`,
    ``
  );

  // 2. Account Background (if available)
  if (opportunity.accountResearch) {
    sections.push(`## Account Research`, ``, opportunity.accountResearch, ``);
  } else if (opportunity.account?.notes) {
    sections.push(`## Account Notes`, ``, opportunity.account.notes, ``);
  }

  // 3. Consolidated Insights (if available)
  if (
    opportunity.consolidatedPainPoints ||
    opportunity.consolidatedGoals ||
    opportunity.consolidatedRiskAssessment
  ) {
    sections.push(
      `## Key Insights from ${opportunity.consolidationCallCount || 0} Sales Calls`,
      ``
    );

    if (opportunity.consolidatedPainPoints) {
      const painPoints = opportunity.consolidatedPainPoints as string[];
      sections.push(
        `### Pain Points`,
        ...painPoints.map((p) => `- ${p}`),
        ``
      );
    }

    if (opportunity.consolidatedGoals) {
      const goals = opportunity.consolidatedGoals as string[];
      sections.push(`### Customer Goals`, ...goals.map((g) => `- ${g}`), ``);
    }

    if (opportunity.consolidatedRiskAssessment) {
      const riskAssessment = opportunity.consolidatedRiskAssessment as {
        riskLevel?: string;
        overallSummary?: string;
        riskFactors?: Array<{ category: string; description: string }>;
      };
      sections.push(
        `### Risk Assessment`,
        `- **Risk Level**: ${riskAssessment.riskLevel || "Unknown"}`,
        `- **Summary**: ${riskAssessment.overallSummary || "No summary"}`,
        ``
      );

      if (riskAssessment.riskFactors && riskAssessment.riskFactors.length > 0) {
        sections.push(
          `**Top Risks**:`,
          ...riskAssessment.riskFactors
            .slice(0, 3)
            .map((r) => `  - ${r.category}: ${r.description}`),
          ``
        );
      }
    }
  }

  // 4. Decision Makers & Key Contacts
  if (opportunity.contacts.length > 0) {
    sections.push(`## Key Contacts`, ``);

    const decisionMakers = opportunity.contacts.filter(
      (c) => c.role === "decision_maker"
    );
    const champions = opportunity.contacts.filter((c) => c.role === "champion");
    const others = opportunity.contacts.filter(
      (c) => c.role !== "decision_maker" && c.role !== "champion"
    );

    if (decisionMakers.length > 0) {
      sections.push(
        `### Decision Makers`,
        ...decisionMakers.map(
          (c) =>
            `- ${c.firstName} ${c.lastName} (${c.title || "No title"}): ${formatSentiment(c.sentiment)}`
        ),
        ``
      );
    }

    if (champions.length > 0) {
      sections.push(
        `### Champions`,
        ...champions.map(
          (c) =>
            `- ${c.firstName} ${c.lastName} (${c.title || "No title"}): ${formatSentiment(c.sentiment)}`
        ),
        ``
      );
    }

    if (others.length > 0) {
      sections.push(
        `### Other Contacts`,
        ...others.map(
          (c) =>
            `- ${c.firstName} ${c.lastName} (${c.title || "No title"}): ${formatRole(c.role)}, ${formatSentiment(c.sentiment)}`
        ),
        ``
      );
    }
  }

  // 5. Recent Gong Calls (metadata + insights, not full transcripts)
  if (opportunity.gongCalls.length > 0) {
    sections.push(`## Recent Sales Calls`, ``);

    opportunity.gongCalls.forEach((call, index) => {
      sections.push(
        `### Call ${index + 1}: ${call.title} (${formatDateShort(call.meetingDate)})`,
        ``
      );

      if (call.painPoints && Array.isArray(call.painPoints) && call.painPoints.length > 0) {
        sections.push(`**Pain Points**:`, ...call.painPoints.map((p) => `- ${p}`), ``);
      }

      if (call.goals && Array.isArray(call.goals) && call.goals.length > 0) {
        sections.push(`**Goals**:`, ...call.goals.map((g) => `- ${g}`), ``);
      }

      if (call.nextSteps && Array.isArray(call.nextSteps) && call.nextSteps.length > 0) {
        sections.push(`**Next Steps**:`, ...call.nextSteps.map((n) => `- ${n}`), ``);
      }
    });
  }

  // 6. Earnings Transcripts (AI summaries only)
  if (opportunity.earningsTranscripts.length > 0) {
    sections.push(`## Recent Earnings Calls`, ``);

    opportunity.earningsTranscripts.forEach((transcript) => {
      sections.push(
        `### ${transcript.quarter} ${transcript.fiscalYear} (${formatDateShort(transcript.callDate)})`,
        ``
      );

      if (transcript.aiSummary) {
        sections.push(`**Summary**: ${transcript.aiSummary}`, ``);
      }

      if (transcript.executiveSentiment) {
        sections.push(`**Executive Sentiment**: ${transcript.executiveSentiment}`, ``);
      }

      if (transcript.competitiveLandscape) {
        sections.push(`**Competitive Landscape**: ${transcript.competitiveLandscape}`, ``);
      }
    });
  }

  // 7. Upcoming Meetings
  if (opportunity.calendarEvents.length > 0) {
    sections.push(
      `## Upcoming Meetings`,
      ``,
      ...opportunity.calendarEvents.map(
        (event) =>
          `- ${event.summary} (${formatDateShort(event.startTime)}) - ${event.attendees.length} attendees`
      ),
      ``
    );
  }

  // 8. Additional Notes
  if (opportunity.notes) {
    sections.push(`## Additional Notes`, ``, opportunity.notes, ``);
  }

  if (opportunity.riskNotes) {
    sections.push(`## Risk Notes`, ``, opportunity.riskNotes, ``);
  }

  if (opportunity.decisionMakers) {
    sections.push(`## Decision Maker Notes`, ``, opportunity.decisionMakers, ``);
  }

  if (opportunity.competition) {
    sections.push(`## Competitive Landscape`, ``, opportunity.competition, ``);
  }

  // Join all sections
  let context = sections.join("\n");

  // Enforce context size limit
  if (context.length > MAX_CONTEXT_SIZE) {
    console.warn(`[Chat Context] Opportunity context exceeded limit:`, {
      actualSize: context.length,
      maxSize: MAX_CONTEXT_SIZE,
      opportunityId: opportunity.id,
    });

    // Truncate to max size with ellipsis
    context = context.substring(0, MAX_CONTEXT_SIZE - 100) + "\n\n... (context truncated due to size limit)";
  }

  return {
    context,
    size: context.length,
  };
}

/**
 * Build comprehensive context for account chat
 * @param accountId - ID of the account
 * @param organizationId - Organization ID for multi-tenant isolation
 * @returns Formatted context string
 */
export async function buildAccountContext(
  accountId: string,
  organizationId: string
): Promise<{ context: string; size: number }> {
  // Fetch comprehensive account data
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      organizationId,
    },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      opportunities: {
        select: {
          id: true,
          name: true,
          amountArr: true,
          stage: true,
          confidenceLevel: true,
          closeDate: true,
          forecastCategory: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
      contacts: {
        select: {
          firstName: true,
          lastName: true,
          title: true,
          role: true,
          sentiment: true,
          notes: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      secFilings: {
        where: {
          processingStatus: "completed",
        },
        select: {
          filingType: true,
          filingDate: true,
          fiscalYear: true,
          businessOverview: true,
          strategicInitiatives: true,
          aiSummary: true,
        },
        orderBy: {
          filingDate: "desc",
        },
        take: 2, // Most recent 2 filings
      },
      earningsTranscripts: {
        where: {
          processingStatus: "completed",
        },
        select: {
          quarter: true,
          fiscalYear: true,
          callDate: true,
          aiSummary: true,
          executiveSentiment: true,
          competitiveLandscape: true,
        },
        orderBy: {
          callDate: "desc",
        },
        take: 3, // Most recent 3 earnings calls
      },
    },
  });

  if (!account) {
    throw new Error("Account not found");
  }

  // Build context sections
  const sections: string[] = [];

  // 1. Account Overview
  sections.push(
    `# Account: ${account.name}`,
    ``,
    `## Overview`,
    `- **Industry**: ${account.industry || "Unknown"}`,
    `- **Website**: ${account.website || "Not provided"}`,
    `- **Ticker**: ${account.ticker || "Not public"}`,
    `- **Health**: ${formatHealth(account.health)}`,
    `- **Priority**: ${formatPriority(account.priority)}`,
    `- **Owner**: ${account.owner?.name || account.owner?.email || "No owner"}`,
    ``
  );

  // 2. Account Notes
  if (account.notes) {
    sections.push(`## Account Notes`, ``, account.notes, ``);
  }

  // 3. Active Opportunities
  if (account.opportunities.length > 0) {
    const activeOpps = account.opportunities.filter(
      (o) => o.stage !== "closedWon" && o.stage !== "closedLost"
    );
    const closedWonOpps = account.opportunities.filter((o) => o.stage === "closedWon");

    if (activeOpps.length > 0) {
      sections.push(
        `## Active Opportunities (${activeOpps.length})`,
        ``,
        ...activeOpps.map(
          (opp) =>
            `- **${opp.name}**: ${formatCurrencyCompact(opp.amountArr)} ARR, ${formatStage(opp.stage)}, Confidence ${opp.confidenceLevel}/5${opp.closeDate ? `, Close: ${formatDateShort(opp.closeDate)}` : ""}`
        ),
        ``
      );
    }

    if (closedWonOpps.length > 0) {
      const totalWon = closedWonOpps.reduce((sum, opp) => sum + opp.amountArr, 0);
      sections.push(
        `## Closed Won Opportunities (${closedWonOpps.length})`,
        `- **Total Won**: ${formatCurrencyCompact(totalWon)}`,
        ``,
        ...closedWonOpps.map(
          (opp) => `- **${opp.name}**: ${formatCurrencyCompact(opp.amountArr)} ARR`
        ),
        ``
      );
    }
  }

  // 4. Key Contacts
  if (account.contacts.length > 0) {
    sections.push(`## Key Contacts`, ``);

    const decisionMakers = account.contacts.filter((c) => c.role === "decision_maker");
    const champions = account.contacts.filter((c) => c.role === "champion");
    const others = account.contacts.filter(
      (c) => c.role !== "decision_maker" && c.role !== "champion"
    );

    if (decisionMakers.length > 0) {
      sections.push(
        `### Decision Makers`,
        ...decisionMakers.map(
          (c) =>
            `- ${c.firstName} ${c.lastName} (${c.title || "No title"}): ${formatSentiment(c.sentiment)}`
        ),
        ``
      );
    }

    if (champions.length > 0) {
      sections.push(
        `### Champions`,
        ...champions.map(
          (c) =>
            `- ${c.firstName} ${c.lastName} (${c.title || "No title"}): ${formatSentiment(c.sentiment)}`
        ),
        ``
      );
    }

    if (others.length > 0) {
      sections.push(
        `### Other Contacts`,
        ...others.slice(0, 10).map(
          (c) =>
            `- ${c.firstName} ${c.lastName} (${c.title || "No title"}): ${formatRole(c.role)}, ${formatSentiment(c.sentiment)}`
        ),
        ``
      );
    }
  }

  // 5. SEC Filings (AI summaries only)
  if (account.secFilings.length > 0) {
    sections.push(`## Recent SEC Filings`, ``);

    account.secFilings.forEach((filing) => {
      sections.push(
        `### ${filing.filingType} (${formatDateShort(filing.filingDate)})${filing.fiscalYear ? ` - FY ${filing.fiscalYear}` : ""}`,
        ``
      );

      if (filing.aiSummary) {
        sections.push(`**AI Summary**: ${filing.aiSummary}`, ``);
      }

      if (filing.businessOverview) {
        sections.push(`**Business Overview**: ${filing.businessOverview.slice(0, 500)}...`, ``);
      }

      if (filing.strategicInitiatives) {
        sections.push(`**Strategic Initiatives**: ${filing.strategicInitiatives}`, ``);
      }
    });
  }

  // 6. Earnings Transcripts (AI summaries only)
  if (account.earningsTranscripts.length > 0) {
    sections.push(`## Recent Earnings Calls`, ``);

    account.earningsTranscripts.forEach((transcript) => {
      sections.push(
        `### ${transcript.quarter} ${transcript.fiscalYear} (${formatDateShort(transcript.callDate)})`,
        ``
      );

      if (transcript.aiSummary) {
        sections.push(`**Summary**: ${transcript.aiSummary}`, ``);
      }

      if (transcript.executiveSentiment) {
        sections.push(`**Executive Sentiment**: ${transcript.executiveSentiment}`, ``);
      }

      if (transcript.competitiveLandscape) {
        sections.push(`**Competitive Landscape**: ${transcript.competitiveLandscape}`, ``);
      }
    });
  }

  // Join all sections
  let context = sections.join("\n");

  // Enforce context size limit
  if (context.length > MAX_CONTEXT_SIZE) {
    console.warn(`[Chat Context] Account context exceeded limit:`, {
      actualSize: context.length,
      maxSize: MAX_CONTEXT_SIZE,
      accountId: account.id,
    });

    // Truncate to max size with ellipsis
    context = context.substring(0, MAX_CONTEXT_SIZE - 100) + "\n\n... (context truncated due to size limit)";
  }

  return {
    context,
    size: context.length,
  };
}

// Helper formatting functions

function formatStage(stage: string): string {
  const stageMap: Record<string, string> = {
    discovery: "Discovery",
    demo: "Demo",
    validateSolution: "Validate Solution",
    decisionMakerApproval: "Decision Maker Approval",
    contracting: "Contracting",
    closedWon: "Closed Won",
    closedLost: "Closed Lost",
  };
  return stageMap[stage] || stage;
}

function formatForecastCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    pipeline: "Pipeline",
    bestCase: "Best Case",
    commit: "Commit",
    closedWon: "Closed Won",
    closedLost: "Closed Lost",
  };
  return categoryMap[category] || category;
}

function formatSentiment(sentiment: string): string {
  const sentimentMap: Record<string, string> = {
    advocate: "🟢 Advocate",
    positive: "🟢 Positive",
    neutral: "🟡 Neutral",
    negative: "🔴 Negative",
    unknown: "⚪ Unknown",
  };
  return sentimentMap[sentiment] || sentiment;
}

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    decision_maker: "Decision Maker",
    influencer: "Influencer",
    champion: "Champion",
    blocker: "Blocker",
    end_user: "End User",
  };
  return roleMap[role] || role;
}

function formatHealth(health: string): string {
  const healthMap: Record<string, string> = {
    good: "🟢 Good",
    "at-risk": "🟡 At Risk",
    critical: "🔴 Critical",
  };
  return healthMap[health] || health;
}

function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "⭐ High",
  };
  return priorityMap[priority] || priority;
}
