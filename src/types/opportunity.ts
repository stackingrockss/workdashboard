export type OpportunityStage =
  | "discovery"
  | "demo"
  | "validateSolution"
  | "decisionMakerApproval"
  | "contracting"
  | "closedWon"
  | "closedLost";

// Helper function to get default confidence level for each stage (1-5 scale)
export function getDefaultConfidenceLevel(stage: OpportunityStage): number {
  const confidenceLevelMap: Record<OpportunityStage, number> = {
    discovery: 1,
    demo: 2,
    validateSolution: 3,
    decisionMakerApproval: 4,
    contracting: 5,
    closedWon: 5,
    closedLost: 1,
  };
  return confidenceLevelMap[stage];
}

// Helper function to get default forecast category for each stage
export function getDefaultForecastCategory(stage: OpportunityStage): ForecastCategory {
  const forecastCategoryMap: Record<OpportunityStage, ForecastCategory> = {
    discovery: "pipeline",
    demo: "pipeline",
    validateSolution: "pipeline",
    decisionMakerApproval: "bestCase",
    contracting: "bestCase",
    closedWon: "forecast",
    closedLost: "pipeline",
  };
  return forecastCategoryMap[stage];
}

// Helper function to get display label for each stage
export function getStageLabel(stage: OpportunityStage): string {
  const labelMap: Record<OpportunityStage, string> = {
    discovery: "Discovery",
    demo: "Demo",
    validateSolution: "Validate Solution",
    decisionMakerApproval: "Decision Maker Approval",
    contracting: "Contracting",
    closedWon: "Closed Won",
    closedLost: "Closed Lost",
  };
  return labelMap[stage];
}

export type ForecastCategory = "pipeline" | "bestCase" | "forecast";

export type ReviewStatus = "not_started" | "in_progress" | "complete" | "not_applicable";

export type PlatformType = "oem" | "api" | "isv";

export type AccountResearchStatus = "generating" | "completed" | "failed";

// Meeting Brief Metadata Types
export interface MeetingBriefMetadata {
  executiveSummary: {
    criticalInsight: string;
    topQuestions: string[];
    keyMetrics: Array<{
      metric: string;
      value: string;
      talkingPoint: string;
    }>;
    risks: string[];
    openingLine: string;
  };
  quickReference: {
    conversationStarters: string[];
    discoveryQuestions: Array<{
      priority: "HIGH" | "MEDIUM" | "OPTIONAL";
      question: string;
      whyAsk: string;
      listenFor: string[];
    }>;
    financials: Array<{
      metric: string;
      value: string;
      yoyChange: string;
      howToUse: string;
    }>;
  };
}

export interface OpportunityOwner {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface Opportunity {
  id: string;
  name: string;
  accountId?: string;
  accountName?: string; // Backward compatibility
  account?: {
    id: string;
    name: string;
    website?: string;
  };
  amountArr: number; // annual recurring revenue forecast
  confidenceLevel: number; // 1-5 scale (replaces probability)
  nextStep?: string;
  closeDate?: string; // ISO date string
  quarter?: string; // e.g., "Q1 2025", "Q2 2025"
  stage: OpportunityStage;
  columnId?: string; // New flexible column assignment
  forecastCategory?: ForecastCategory | null;
  riskNotes?: string | null;
  notes?: string | null;
  accountResearch?: string | null;
  accountResearchStatus?: AccountResearchStatus | null;
  accountResearchMobile?: string | null;
  accountResearchMeta?: MeetingBriefMetadata | null;
  accountResearchGeneratedAt?: string | null;
  // New fields from CSV
  decisionMakers?: string | null;
  competition?: string | null;
  legalReviewStatus?: ReviewStatus | null;
  securityReviewStatus?: ReviewStatus | null;
  platformType?: PlatformType | null;
  businessCaseStatus?: ReviewStatus | null;
  pinnedToWhiteboard?: boolean;
  owner: OpportunityOwner;
  granolaNotes?: Array<{
    id: string;
    opportunityId: string;
    title: string;
    url: string;
    meetingDate: string;
    noteType: "customer" | "internal" | "prospect";
    createdAt: string;
    updatedAt: string;
  }>;
  gongCalls?: Array<{
    id: string;
    opportunityId: string;
    title: string;
    url: string;
    meetingDate: string;
    noteType: "customer" | "internal" | "prospect";
    createdAt: string;
    updatedAt: string;
  }>;
  googleNotes?: Array<{
    id: string;
    opportunityId: string;
    title: string;
    url: string;
    createdAt: string;
    updatedAt: string;
  }>;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface KanbanColumnConfig {
  id: string;
  title: string;
  order: number;
  color: string | null | undefined;
  viewId: string;
  createdAt: string;
  updatedAt: string;
}

// Helper function to get display label for review status
export function getReviewStatusLabel(status: ReviewStatus): string {
  const labelMap: Record<ReviewStatus, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
    not_applicable: "N/A",
  };
  return labelMap[status];
}

// Helper function to get display label for platform type
export function getPlatformTypeLabel(type: PlatformType): string {
  const labelMap: Record<PlatformType, string> = {
    oem: "OEM",
    api: "API",
    isv: "ISV",
  };
  return labelMap[type];
}

// Helper function to get display label for confidence level
export function getConfidenceLevelLabel(level: number): string {
  const labelMap: Record<number, string> = {
    1: "Very Low",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Very High",
  };
  return labelMap[level] || "Unknown";
}


