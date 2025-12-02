import { Opportunity } from "@/types/opportunity";
import { SerializedKanbanColumn, BUILT_IN_VIEW_IDS } from "@/types/view";

/**
 * ARR value buckets for customer segmentation
 * Based on typical enterprise SaaS deal sizes
 */
export type CustomerValueBucket = "enterprise" | "midMarket" | "commercial" | "smb";

/**
 * ARR thresholds for customer segmentation
 */
const ARR_THRESHOLDS = {
  ENTERPRISE: 500000, // $500K+
  MID_MARKET: 100000, // $100K - $500K
  COMMERCIAL: 25000, // $25K - $100K
  // SMB: < $25K
};

/**
 * Converts a value bucket to its corresponding virtual column ID
 */
export function customerBucketToColumnId(bucket: CustomerValueBucket): string {
  const kebabCase = bucket
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");

  return `virtual-customers-${kebabCase}`;
}

/**
 * Generate virtual columns for the Customers view
 * Groups by ARR value: Enterprise ($500K+), Mid-Market ($100K-$500K),
 * Commercial ($25K-$100K), SMB (<$25K)
 */
export function generateCustomersColumns(): SerializedKanbanColumn[] {
  const buckets = [
    { id: "enterprise", title: "Enterprise ($500K+)", color: "#8b5cf6" }, // violet-500
    { id: "midMarket", title: "Mid-Market ($100K-$500K)", color: "#3b82f6" }, // blue-500
    { id: "commercial", title: "Commercial ($25K-$100K)", color: "#10b981" }, // emerald-500
    { id: "smb", title: "SMB (<$25K)", color: "#6b7280" }, // gray-500
  ];

  const now = new Date().toISOString();

  return buckets.map((bucket, index) => ({
    id: `virtual-customers-${bucket.id.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")}`,
    title: bucket.title,
    order: index,
    color: bucket.color,
    viewId: BUILT_IN_VIEW_IDS.CUSTOMERS,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Determine which value bucket a customer falls into based on ARR
 */
function getCustomerValueBucket(amountArr: number): CustomerValueBucket {
  if (amountArr >= ARR_THRESHOLDS.ENTERPRISE) {
    return "enterprise";
  } else if (amountArr >= ARR_THRESHOLDS.MID_MARKET) {
    return "midMarket";
  } else if (amountArr >= ARR_THRESHOLDS.COMMERCIAL) {
    return "commercial";
  }
  return "smb";
}

/**
 * Groups closed won opportunities by ARR value bucket
 * Only includes opportunities with stage = "closedWon"
 */
export function groupOpportunitiesByCustomerValue(
  opportunities: Opportunity[]
): Record<string, Opportunity[]> {
  const grouped: Record<string, Opportunity[]> = {
    "virtual-customers-enterprise": [],
    "virtual-customers-mid-market": [],
    "virtual-customers-commercial": [],
    "virtual-customers-smb": [],
  };

  // Only include closedWon opportunities
  const customerOpps = opportunities.filter((opp) => opp.stage === "closedWon");

  customerOpps.forEach((opp) => {
    const bucket = getCustomerValueBucket(opp.amountArr);
    const columnId = customerBucketToColumnId(bucket);

    if (grouped[columnId]) {
      grouped[columnId].push(opp);
    }
  });

  return grouped;
}

/**
 * Extracts the value bucket from a virtual column ID
 */
export function columnIdToCustomerBucket(
  columnId: string
): CustomerValueBucket | null {
  if (!columnId.startsWith("virtual-customers-")) {
    return null;
  }

  const kebabCase = columnId.replace("virtual-customers-", "");

  // Convert kebab-case to camelCase
  const camelCase = kebabCase.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  const validBuckets: CustomerValueBucket[] = [
    "enterprise",
    "midMarket",
    "commercial",
    "smb",
  ];
  if (validBuckets.includes(camelCase as CustomerValueBucket)) {
    return camelCase as CustomerValueBucket;
  }

  return null;
}
