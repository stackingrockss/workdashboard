import { Opportunity, OpportunityStage } from "@/types/opportunity";

/**
 * Converts an opportunity stage to its corresponding virtual column ID
 * @param stage - The opportunity stage (e.g., "discovery", "demo", "validateSolution")
 * @returns Virtual column ID (e.g., "virtual-stage-discovery", "virtual-stage-validate-solution")
 */
export function stageToColumnId(stage: OpportunityStage): string {
  // Convert camelCase to kebab-case for column IDs
  const kebabCase = stage
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");

  return `virtual-stage-${kebabCase}`;
}

/**
 * Groups opportunities by their stage for the Sales Stages view
 * @param opportunities - Array of opportunities to group
 * @returns Record mapping virtual column IDs to arrays of opportunities
 */
export function groupOpportunitiesByStage(
  opportunities: Opportunity[]
): Record<string, Opportunity[]> {
  const grouped: Record<string, Opportunity[]> = {
    "virtual-stage-discovery": [],
    "virtual-stage-demo": [],
    "virtual-stage-validate-solution": [],
    "virtual-stage-decision-maker-approval": [],
    "virtual-stage-contracting": [],
  };

  // Filter out closed opportunities - they belong in dedicated Customers/Closed Lost views
  opportunities
    .filter((opp) => opp.stage !== "closedWon" && opp.stage !== "closedLost")
    .forEach((opp) => {
      const columnId = stageToColumnId(opp.stage);

      if (grouped[columnId]) {
        grouped[columnId].push(opp);
      }
    });

  return grouped;
}

/**
 * Extracts the opportunity stage from a virtual column ID
 * @param columnId - Virtual column ID (e.g., "virtual-stage-validate-solution")
 * @returns Opportunity stage or null if invalid
 */
export function columnIdToStage(columnId: string): OpportunityStage | null {
  if (!columnId.startsWith("virtual-stage-")) {
    return null;
  }

  const kebabCase = columnId.replace("virtual-stage-", "");

  // Convert kebab-case to camelCase
  const camelCase = kebabCase.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  // Validate it's a valid opportunity stage
  const validStages: OpportunityStage[] = [
    "discovery",
    "demo",
    "validateSolution",
    "decisionMakerApproval",
    "contracting",
    "closedWon",
    "closedLost",
  ];

  if (validStages.includes(camelCase as OpportunityStage)) {
    return camelCase as OpportunityStage;
  }

  return null;
}
