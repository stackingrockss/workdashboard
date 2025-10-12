export type OpportunityStage =
  | "prospect"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closedWon"
  | "closedLost";

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


