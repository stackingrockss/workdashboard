import { Opportunity } from "@/types/opportunity";

export interface DashboardStats {
  totalOpportunities: number;
  totalValue: number;
  weightedValue: number;
  avgConfidenceLevel: number;
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
  // Weighted value: confidence level 1-5 converted to percentage (20%, 40%, 60%, 80%, 100%)
  const weightedValue = opportunities.reduce(
    (sum, opp) => sum + (opp.amountArr * opp.confidenceLevel) / 5,
    0
  );
  const avgConfidenceLevel = totalOpportunities > 0
    ? opportunities.reduce((sum, opp) => sum + opp.confidenceLevel, 0) / totalOpportunities
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

  // Stage order from closest to closing to furthest
  const stageOrder: Record<string, number> = {
    contracting: 1,
    decisionMakerApproval: 2,
    validateSolution: 3,
    demo: 4,
    discovery: 5,
    closedWon: 6,
    closedLost: 7,
  };

  const byStage = Array.from(stageMap.entries())
    .map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
    }))
    .sort((a, b) => {
      const orderA = stageOrder[a.stage] ?? 99;
      const orderB = stageOrder[b.stage] ?? 99;
      return orderA - orderB;
    });

  // Group by quarter
  const quarterMap = new Map<string, { count: number; value: number; weightedValue: number }>();
  opportunities.forEach(opp => {
    const quarter = opp.quarter || "Unassigned";
    const current = quarterMap.get(quarter) || { count: 0, value: 0, weightedValue: 0 };
    quarterMap.set(quarter, {
      count: current.count + 1,
      value: current.value + opp.amountArr,
      weightedValue: current.weightedValue + (opp.amountArr * opp.confidenceLevel) / 5,
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
      // Parse "Q1 2026" format to sort chronologically
      const parseQuarter = (q: string) => {
        const match = q.match(/Q(\d)\s+(\d{4})/);
        if (!match) return { year: 0, quarter: 0 };
        return { year: parseInt(match[2]), quarter: parseInt(match[1]) };
      };
      const qA = parseQuarter(a.quarter);
      const qB = parseQuarter(b.quarter);
      if (qA.year !== qB.year) return qA.year - qB.year;
      return qA.quarter - qB.quarter;
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
    avgConfidenceLevel,
    wonOpportunities,
    lostOpportunities,
    winRate,
    byStage,
    byQuarter,
    recentActivity,
  };
}
