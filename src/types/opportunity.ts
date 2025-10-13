export type OpportunityStage =
  | "discovery"
  | "demo"
  | "validateSolution"
  | "decisionMakerApproval"
  | "contracting"
  | "closedWon"
  | "closedLost";

// Helper function to get default probability for each stage
export function getDefaultProbability(stage: OpportunityStage): number {
  const probabilityMap: Record<OpportunityStage, number> = {
    discovery: 10,
    demo: 20,
    validateSolution: 40,
    decisionMakerApproval: 60,
    contracting: 90,
    closedWon: 100,
    closedLost: 0,
  };
  return probabilityMap[stage];
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

export interface OpportunityOwner {
  id: string;
  name: string;
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
  };
  amountArr: number; // annual recurring revenue forecast
  probability: number; // 0-100
  nextStep?: string;
  closeDate?: string; // ISO date string
  quarter?: string; // e.g., "Q1 2025", "Q2 2025"
  stage: OpportunityStage;
  columnId?: string; // New flexible column assignment
  forecastCategory?: ForecastCategory | null;
  riskNotes?: string | null;
  notes?: string | null;
  accountResearch?: string | null;
  owner: OpportunityOwner;
  granolaNotes?: Array<{
    id: string;
    opportunityId: string;
    title: string;
    url: string;
    createdAt: string;
    updatedAt: string;
  }>;
  gongCalls?: Array<{
    id: string;
    opportunityId: string;
    title: string;
    url: string;
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
  color?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}


