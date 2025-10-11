export type OpportunityStage =
  | "prospect"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closedWon"
  | "closedLost";

export interface OpportunityOwner {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Opportunity {
  id: string;
  name: string;
  account: string;
  amountArr: number; // annual recurring revenue forecast
  probability: number; // 0-100
  nextStep?: string;
  closeDate?: string; // ISO date string
  stage: OpportunityStage;
  owner: OpportunityOwner;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface KanbanColumnConfig {
  id: OpportunityStage;
  title: string;
}


