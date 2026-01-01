// Types for the AI Content Generation Briefs

export type BriefCategory =
  | "mutual_action_plan"
  | "pricing_proposal"
  | "business_case"
  | "proposal"
  | "email"
  | "account_plan"
  | "executive_summary"
  | "internal_prep_doc"
  | "notes"
  | "general"
  | "other"
  | "business_impact_proposal"
  | "account_research";

export type BriefScope = "company" | "personal" | "template";

export type ContentGenerationStatus = "pending" | "generating" | "completed" | "failed";

export interface BriefSection {
  title: string;
  description?: string;
  required?: boolean;
}

export interface ContextConfig {
  meetings?: boolean;
  files?: boolean;
  notes?: boolean;
  accountResearch?: boolean;
}

export interface ReferenceContent {
  id: string;
  title: string;
  contentType: string;
  description?: string | null;
  body?: string | null;
}

export interface ContentBrief {
  id: string;
  name: string;
  description?: string | null;
  category: BriefCategory;
  scope: BriefScope;
  systemInstruction: string;
  outputFormat?: string | null;
  sections: BriefSection[];
  contextConfig?: ContextConfig | null;
  createdById: string | null;
  organizationId: string | null;
  isDefault: boolean;
  usageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  referenceContents?: ReferenceContent[];
}

export interface ContextSelection {
  gongCallIds: string[];
  granolaNoteIds: string[];
  googleNoteIds: string[];
  includeAccountResearch: boolean;
  includeConsolidatedInsights: boolean;
  additionalContext?: string;
  referenceDocumentIds?: string[];
  referenceContentIds?: string[];
  // Include full meeting transcripts (defaults to false - uses extracted insights only)
  includeMeetingTranscripts?: boolean;
}

export interface GeneratedContent {
  id: string;
  briefId: string;
  opportunityId: string;
  title: string;
  content: string;
  contextSnapshot?: ContextSelection | null;
  version: number;
  parentVersionId?: string | null;
  generationStatus: ContentGenerationStatus;
  generatedAt?: Date | string | null;
  generationError?: string | null;
  createdById: string;
  organizationId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  brief?: ContentBrief;
  createdBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export interface GeneratedContentWithVersions extends GeneratedContent {
  versions: Array<{
    id: string;
    version: number;
    createdAt: Date | string;
    createdBy?: {
      id: string;
      name: string | null;
    };
  }>;
}

export const BRIEF_CATEGORY_LABELS: Record<BriefCategory, string> = {
  mutual_action_plan: "Mutual Action Plan",
  pricing_proposal: "Pricing Proposal",
  business_case: "Business Case",
  proposal: "Proposal",
  email: "Email",
  account_plan: "Account Plan",
  executive_summary: "Executive Summary",
  internal_prep_doc: "Internal Prep Doc",
  notes: "Notes",
  general: "General",
  other: "Other",
  business_impact_proposal: "Business Impact Proposal",
  account_research: "Account Research",
};

export const BRIEF_CATEGORY_OPTIONS = Object.entries(BRIEF_CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as BriefCategory, label })
);

export const BRIEF_SCOPE_LABELS: Record<BriefScope, string> = {
  company: "Company",
  personal: "Personal",
  template: "Templates",
};

// Backwards compatibility aliases (deprecated - remove after full migration)
/** @deprecated Use BriefCategory instead */
export type FrameworkCategory = BriefCategory;
/** @deprecated Use BriefScope instead */
export type FrameworkScope = BriefScope;
/** @deprecated Use BriefSection instead */
export type FrameworkSection = BriefSection;
/** @deprecated Use ContentBrief instead */
export type ContentFramework = ContentBrief;
/** @deprecated Use BRIEF_CATEGORY_LABELS instead */
export const FRAMEWORK_CATEGORY_LABELS = BRIEF_CATEGORY_LABELS;
/** @deprecated Use BRIEF_CATEGORY_OPTIONS instead */
export const FRAMEWORK_CATEGORY_OPTIONS = BRIEF_CATEGORY_OPTIONS;
/** @deprecated Use BRIEF_SCOPE_LABELS instead */
export const FRAMEWORK_SCOPE_LABELS = BRIEF_SCOPE_LABELS;
