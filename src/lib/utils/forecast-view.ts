import { Opportunity, ForecastCategory } from "@/types/opportunity";

/**
 * Converts a forecast category to its corresponding virtual column ID
 * @param category - The forecast category (e.g., "pipeline", "bestCase", "commit")
 * @returns Virtual column ID (e.g., "virtual-forecast-pipeline", "virtual-forecast-best-case")
 */
export function forecastCategoryToColumnId(category: ForecastCategory): string {
  // Convert camelCase to kebab-case for column IDs
  const kebabCase = category
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");

  return `virtual-forecast-${kebabCase}`;
}

/**
 * Groups opportunities by their forecast category for the Forecast Categories view
 * @param opportunities - Array of opportunities to group
 * @returns Record mapping virtual column IDs to arrays of opportunities
 */
export function groupOpportunitiesByForecast(
  opportunities: Opportunity[]
): Record<string, Opportunity[]> {
  const grouped: Record<string, Opportunity[]> = {
    "virtual-forecast-pipeline": [],
    "virtual-forecast-best-case": [],
    "virtual-forecast-commit": [],
    "virtual-forecast-closed-won": [],
    "virtual-forecast-closed-lost": [],
  };

  opportunities.forEach((opp) => {
    // Use the opportunity's forecast category, or default to pipeline if not set
    const category = opp.forecastCategory || "pipeline";
    const columnId = forecastCategoryToColumnId(category);

    if (grouped[columnId]) {
      grouped[columnId].push(opp);
    } else {
      // Fallback to pipeline if unexpected category
      grouped["virtual-forecast-pipeline"].push(opp);
    }
  });

  return grouped;
}

/**
 * Extracts the forecast category from a virtual column ID
 * @param columnId - Virtual column ID (e.g., "virtual-forecast-commit")
 * @returns Forecast category or null if invalid
 */
export function columnIdToForecastCategory(columnId: string): ForecastCategory | null {
  if (!columnId.startsWith("virtual-forecast-")) {
    return null;
  }

  const kebabCase = columnId.replace("virtual-forecast-", "");

  // Convert kebab-case to camelCase
  const camelCase = kebabCase.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  // Validate it's a valid forecast category
  const validCategories: ForecastCategory[] = ["pipeline", "bestCase", "commit", "closedWon", "closedLost"];
  if (validCategories.includes(camelCase as ForecastCategory)) {
    return camelCase as ForecastCategory;
  }

  return null;
}
