import { Opportunity } from "@/types/opportunity";

export interface DashboardStats {
  totalOpportunities: number;
  totalValue: number;
  weightedValue: number;
  avgProbability: number;
  wonOpportunities: number;
  lostOpportunities: number;
  winRate: number;
  byStage: {
    stage: string;
    count: number;
    value: number;
  }[];
  byQuarter: {
    quarter: string;
    count: number;
    value: number;
    weightedValue: number;
  }[];
  recentActivity: {
    id: string;
    name: string;
    accountName: string;
    action: string;
    timestamp: string;
  }[];
}

export function calculateDashboardStats(opportunities: Opportunity[]): DashboardStats {
  const totalOpportunities = opportunities.length;
  const totalValue = opportunities.reduce((sum, opp) => sum + opp.amountArr, 0);
  const weightedValue = opportunities.reduce(
    (sum, opp) => sum + (opp.amountArr * opp.probability) / 100,
    0
  );
  const avgProbability = totalOpportunities > 0
    ? opportunities.reduce((sum, opp) => sum + opp.probability, 0) / totalOpportunities
    : 0;

  const wonOpportunities = opportunities.filter(opp => opp.stage === "closedWon").length;
  const lostOpportunities = opportunities.filter(opp => opp.stage === "closedLost").length;
  const closedOpportunities = wonOpportunities + lostOpportunities;
  const winRate = closedOpportunities > 0 ? (wonOpportunities / closedOpportunities) * 100 : 0;

  // Group by stage
  const stageMap = new Map<string, { count: number; value: number }>();
  opportunities.forEach(opp => {
    const current = stageMap.get(opp.stage) || { count: 0, value: 0 };
    stageMap.set(opp.stage, {
      count: current.count + 1,
      value: current.value + opp.amountArr,
    });
  });

  const byStage = Array.from(stageMap.entries()).map(([stage, data]) => ({
    stage,
    count: data.count,
    value: data.value,
  }));

  // Group by quarter
  const quarterMap = new Map<string, { count: number; value: number; weightedValue: number }>();
  opportunities.forEach(opp => {
    const quarter = opp.quarter || "Unassigned";
    const current = quarterMap.get(quarter) || { count: 0, value: 0, weightedValue: 0 };
    quarterMap.set(quarter, {
      count: current.count + 1,
      value: current.value + opp.amountArr,
      weightedValue: current.weightedValue + (opp.amountArr * opp.probability) / 100,
    });
  });

  const byQuarter = Array.from(quarterMap.entries())
    .map(([quarter, data]) => ({
      quarter,
      count: data.count,
      value: data.value,
      weightedValue: data.weightedValue,
    }))
    .sort((a, b) => {
      if (a.quarter === "Unassigned") return 1;
      if (b.quarter === "Unassigned") return -1;
      return a.quarter.localeCompare(b.quarter);
    });

  // Recent activity (last 5 updated)
  const recentActivity = opportunities
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map(opp => ({
      id: opp.id,
      name: opp.name,
      accountName: opp.account?.name || opp.accountName || "No Account",
      action: `Updated to ${opp.stage}`,
      timestamp: opp.updatedAt,
    }));

  return {
    totalOpportunities,
    totalValue,
    weightedValue,
    avgProbability,
    wonOpportunities,
    lostOpportunities,
    winRate,
    byStage,
    byQuarter,
    recentActivity,
  };
}
