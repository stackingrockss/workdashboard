// app/opportunities/[id]/page.tsx
// Server component: displays a single opportunity from the database

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OpportunityDetailClient } from "@/components/features/opportunities/opportunity-detail-client";
import { requireAuthOrRedirect } from "@/lib/auth";
import type { RiskAssessment } from "@/types/gong-call";

interface OpportunityPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: OpportunityPageProps) {
  const { id } = await params;

  // Require authentication - redirects to /auth/login if not authenticated
  const user = await requireAuthOrRedirect();

  const opportunityFromDB = await prisma.opportunity.findFirst({
    where: {
      id,
      organizationId: user.organization.id, // Security: scope to user's organization
    },
    include: {
      owner: true,
      account: true,
      granolaNotes: {
        orderBy: { createdAt: "desc" },
      },
      gongCalls: {
        orderBy: { createdAt: "desc" },
      },
      googleNotes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!opportunityFromDB) return notFound();

  // Fetch organization users for comment @mentions
  const organizationUsers = await prisma.user.findMany({
    where: {
      organizationId: user.organization.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const opportunity = {
    id: opportunityFromDB.id,
    name: opportunityFromDB.name,
    accountId: opportunityFromDB.accountId || undefined,
    accountName: opportunityFromDB.accountName || undefined,
    account: opportunityFromDB.account ? {
      id: opportunityFromDB.account.id,
      name: opportunityFromDB.account.name,
      ticker: opportunityFromDB.account.ticker || undefined,
      website: opportunityFromDB.account.website || undefined,
      nextEarningsDate: opportunityFromDB.account.nextEarningsDate?.toISOString() || undefined,
      lastEarningsSync: opportunityFromDB.account.lastEarningsSync?.toISOString() || undefined,
      earningsDateSource: opportunityFromDB.account.earningsDateSource || undefined,
    } : undefined,
    amountArr: opportunityFromDB.amountArr,
    confidenceLevel: opportunityFromDB.confidenceLevel,
    nextStep: opportunityFromDB.nextStep || undefined,
    cbc: opportunityFromDB.cbc?.toISOString() || undefined,
    cbcLastCalculated: opportunityFromDB.cbcLastCalculated?.toISOString() || undefined,
    lastCallDate: opportunityFromDB.lastCallDate?.toISOString() || undefined,
    lastCallDateSource: opportunityFromDB.lastCallDateSource || undefined,
    lastCallDateEventId: opportunityFromDB.lastCallDateEventId || undefined,
    needsNextCallScheduled: opportunityFromDB.needsNextCallScheduled || undefined,
    closeDate: opportunityFromDB.closeDate?.toISOString().split('T')[0] || undefined,
    quarter: opportunityFromDB.quarter || undefined,
    stage: opportunityFromDB.stage,
    forecastCategory: opportunityFromDB.forecastCategory || undefined,
    riskNotes: opportunityFromDB.riskNotes || undefined,
    notes: opportunityFromDB.notes || undefined,
    accountResearch: opportunityFromDB.accountResearch || undefined,
    accountResearchStatus: opportunityFromDB.accountResearchStatus || undefined,
    painPointsHistory: opportunityFromDB.painPointsHistory || undefined,
    goalsHistory: opportunityFromDB.goalsHistory || undefined,
    nextStepsHistory: opportunityFromDB.nextStepsHistory || undefined,
    decisionMakers: opportunityFromDB.decisionMakers || undefined,
    competition: opportunityFromDB.competition || undefined,
    legalReviewStatus: opportunityFromDB.legalReviewStatus || undefined,
    securityReviewStatus: opportunityFromDB.securityReviewStatus || undefined,
    platformType: opportunityFromDB.platformType || undefined,
    businessCaseStatus: opportunityFromDB.businessCaseStatus || undefined,
    // Consolidated insights from multiple Gong calls (AI-generated)
    consolidatedPainPoints: opportunityFromDB.consolidatedPainPoints ? (opportunityFromDB.consolidatedPainPoints as string[]) : undefined,
    consolidatedGoals: opportunityFromDB.consolidatedGoals ? (opportunityFromDB.consolidatedGoals as string[]) : undefined,
    consolidatedRiskAssessment: opportunityFromDB.consolidatedRiskAssessment ? (opportunityFromDB.consolidatedRiskAssessment as RiskAssessment) : undefined,
    consolidatedWhyAndWhyNow: opportunityFromDB.consolidatedWhyAndWhyNow ? (opportunityFromDB.consolidatedWhyAndWhyNow as string[]) : undefined,
    consolidatedMetrics: opportunityFromDB.consolidatedMetrics ? (opportunityFromDB.consolidatedMetrics as string[]) : undefined,
    lastConsolidatedAt: opportunityFromDB.lastConsolidatedAt?.toISOString() || undefined,
    consolidationCallCount: opportunityFromDB.consolidationCallCount || undefined,
    consolidationStatus: opportunityFromDB.consolidationStatus || undefined,
    // Business Case generation fields
    businessCaseContent: opportunityFromDB.businessCaseContent || undefined,
    businessCaseQuestions: opportunityFromDB.businessCaseQuestions || undefined,
    businessCaseGeneratedAt: opportunityFromDB.businessCaseGeneratedAt?.toISOString() || undefined,
    businessCaseGenerationStatus: (opportunityFromDB.businessCaseGenerationStatus as "generating" | "completed" | "failed") || undefined,
    // Business Impact Proposal fields
    businessProposalContent: opportunityFromDB.businessProposalContent || undefined,
    businessProposalGeneratedAt: opportunityFromDB.businessProposalGeneratedAt?.toISOString() || undefined,
    businessProposalGenerationStatus: (opportunityFromDB.businessProposalGenerationStatus as "generating" | "completed" | "failed") || undefined,
    owner: {
      id: opportunityFromDB.owner.id,
      name: opportunityFromDB.owner.name || opportunityFromDB.owner.email || "Unknown",
      avatarUrl: opportunityFromDB.owner.avatarUrl || undefined,
    },
    granolaNotes: (opportunityFromDB.granolaNotes || []).map(note => ({
      id: note.id,
      opportunityId: note.opportunityId,
      title: note.title,
      url: note.url,
      meetingDate: note.meetingDate.toISOString(),
      noteType: note.noteType as "customer" | "internal" | "prospect",
      calendarEventId: note.calendarEventId || undefined,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    gongCalls: (opportunityFromDB.gongCalls || []).map(call => ({
      id: call.id,
      opportunityId: call.opportunityId,
      organizationId: call.organizationId,
      title: call.title,
      url: call.url,
      meetingDate: call.meetingDate.toISOString(),
      noteType: call.noteType as "customer" | "internal" | "prospect",
      transcriptText: call.transcriptText || undefined,
      parsingStatus: call.parsingStatus || undefined,
      parsedAt: call.parsedAt?.toISOString() || undefined,
      parsingError: call.parsingError || undefined,
      painPoints: call.painPoints as unknown,
      goals: call.goals as unknown,
      parsedPeople: call.parsedPeople as unknown,
      nextSteps: call.nextSteps as unknown,
      riskAssessment: call.riskAssessment as unknown,
      whyAndWhyNow: call.whyAndWhyNow as unknown,
      quantifiableMetrics: call.quantifiableMetrics as unknown,
      calendarEventId: call.calendarEventId || undefined, // For linking to calendar events
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
    })),
    googleNotes: (opportunityFromDB.googleNotes || []).map(note => ({
      id: note.id,
      opportunityId: note.opportunityId,
      title: note.title,
      url: note.url,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    // Next call date fields (auto-calculated or manual)
    nextCallDate: opportunityFromDB.nextCallDate?.toISOString() || undefined,
    nextCallDateSource: opportunityFromDB.nextCallDateSource || undefined,
    nextCallDateManuallySet: opportunityFromDB.nextCallDateManuallySet || undefined,
    nextCallDateLastCalculated: opportunityFromDB.nextCallDateLastCalculated?.toISOString() || undefined,
    nextCallDateEventId: opportunityFromDB.nextCallDateEventId || undefined,
    createdAt: opportunityFromDB.createdAt.toISOString(),
    updatedAt: opportunityFromDB.updatedAt.toISOString(),
  };

  return (
    <OpportunityDetailClient
      opportunity={opportunity}
      organizationId={user.organization.id}
      userId={user.id}
      currentUser={{
        id: user.id,
        role: user.role,
        organizationId: user.organization.id,
      }}
      organizationUsers={organizationUsers}
    />
  );
}


