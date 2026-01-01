import { z } from "zod";

// Helper function to normalize and validate URLs
const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  // If URL doesn't start with http:// or https://, prepend https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

// Lenient URL validation - accepts domains, localhost, IPs
const isValidUrl = (url: string): boolean => {
  // Allow common domain patterns, localhost, and IP addresses
  const urlPattern = /^https?:\/\/([\w-]+(\.[\w-]+)*|localhost)(:\d+)?(\/.*)?$/i;
  const ipPattern = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;

  return urlPattern.test(url) || ipPattern.test(url);
};

const baseOpportunitySchema = z.object({
  name: z.string().min(2).max(120),
  // Support both old account field and new accountId for backward compatibility
  account: z.string().min(1).max(120).optional(),
  accountId: z.string().optional(),
  accountTicker: z.string().max(10).optional().transform(val => val?.trim().toUpperCase() || undefined),
  accountWebsite: z
    .string()
    .min(1, "Company website is required")
    .transform((val) => normalizeUrl(val))
    .refine(
      (val) => isValidUrl(val),
      {
        message: "Please enter a valid URL (e.g., acme.com, localhost:3000, or https://example.com)"
      }
    ),
  amountArr: z.number().int().nonnegative().optional().default(0),
  confidenceLevel: z.number().int().min(1).max(5).optional().default(3), // 1-5 scale (replaces probability)
  nextStep: z.string().max(500).optional().nullable().transform(val => val === "" ? null : val),
  cbc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "CBC date must be in YYYY-MM-DD format").optional().nullable().transform(val => val === "" ? null : val), // Call Between Call date
  nextCallDate: z.string().datetime().optional().nullable(),
  nextCallDateManuallySet: z.boolean().optional(),
  quarter: z.string().max(20).optional().nullable().transform(val => val === "" ? null : val),
  stage: z.enum([
    "discovery",
    "demo",
    "validateSolution",
    "decisionMakerApproval",
    "contracting",
    "closedWon",
    "closedLost",
  ]).optional(),
  columnId: z.string().optional().nullable(), // Support flexible column assignment
  forecastCategory: z.enum(["pipeline", "bestCase", "commit", "closedWon", "closedLost"]).optional().nullable().transform(val => val || "pipeline").default("pipeline"),
  riskNotes: z.string().max(2000).optional().nullable().transform(val => val === "" ? null : val),
  notes: z.string().max(100000).optional().nullable().transform(val => val === "" ? null : val), // Rich text notes
  accountResearch: z.string().max(50000).optional().nullable().transform(val => val === "" ? null : val),
  ownerId: z.string().optional().transform(val => val === "" ? undefined : val),
  // New fields from CSV
  decisionMakers: z.string().max(1000).optional().nullable().transform(val => val === "" ? null : val),
  competition: z.string().max(200).optional().nullable().transform(val => val === "" ? null : val),
  legalReviewStatus: z.enum(["not_started", "in_progress", "complete", "not_applicable"]).optional().nullable().default("not_started"),
  securityReviewStatus: z.enum(["not_started", "in_progress", "complete", "not_applicable"]).optional().nullable().default("not_started"),
  platformType: z.enum(["oem", "api", "isv"]).optional().nullable(),
  businessCaseStatus: z.enum(["not_started", "in_progress", "complete", "not_applicable"]).optional().nullable().default("not_started"),
  pinnedToWhiteboard: z.boolean().optional(),
  // Domain for calendar event matching (e.g., "premera.com")
  domain: z.string().max(255).optional().nullable().transform(val => {
    if (!val) return null;
    // Normalize: lowercase, remove protocol, www, and trailing slashes
    let domain = val.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.replace(/\/.*$/, '');
    return domain || null;
  }),
  painPointsHistory: z.string().optional(),
  goalsHistory: z.string().optional(),
  nextStepsHistory: z.string().optional(),
  // Business case generation fields
  businessCaseContent: z.string().max(100000).optional().nullable().transform(val => val === "" ? null : val),
  businessCaseQuestions: z.string().max(50000).optional().nullable().transform(val => val === "" ? null : val),
  // Account research brief ID - optional override for default research brief
  accountResearchBriefId: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

export const opportunityCreateSchema = baseOpportunitySchema
  .extend({
    // Close date is required for creation - accepts ISO date format (YYYY-MM-DD)
    closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Close date must be in YYYY-MM-DD format").min(1, "Close date is required"),
  })
  .refine(
    (data) => data.account || data.accountId,
    {
      message: "Either account name or accountId must be provided",
      path: ["account"],
    }
  );

export const opportunityUpdateSchema = baseOpportunitySchema
  .extend({
    // Close date is optional for updates - accepts ISO date format (YYYY-MM-DD)
    closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Close date must be in YYYY-MM-DD format").optional().nullable().transform(val => val === "" ? null : val),
  })
  .partial();

export type OpportunityCreateInput = z.infer<typeof opportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;


