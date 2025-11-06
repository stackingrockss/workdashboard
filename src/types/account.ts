export type AccountPriority = "low" | "medium" | "high";
export type AccountHealth = "good" | "at-risk" | "critical";

export interface Account {
  id: string;
  name: string;
  industry?: string;
  priority: AccountPriority;
  health: AccountHealth;
  notes?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface AccountWithOpportunities extends Account {
  opportunities: Array<{
    id: string;
    name: string;
    amountArr: number;
    stage: string;
    confidenceLevel: number;
  }>;
}

export interface AccountStats {
  totalOpportunities: number;
  totalValue: number;
  weightedValue: number;
  avgConfidenceLevel: number;
}
