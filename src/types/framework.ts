// Types for the AI Content Generation Framework

export type FrameworkCategory =
  | "mutual_action_plan"
  | "pricing_proposal"
  | "email"
  | "account_plan"
  | "executive_summary"
  | "internal_prep_doc"
  | "notes"
  | "general"
  | "other"
  | "business_impact_proposal";

export type FrameworkScope = "company" | "personal";

export type ContentGenerationStatus = "pending" | "generating" | "completed" | "failed";

export interface FrameworkSection {
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

export interface ContentFramework {
  id: string;
  name: string;
  description?: string | null;
  category: FrameworkCategory;
  scope: FrameworkScope;
  systemInstruction: string;
  outputFormat?: string | null;
  sections: FrameworkSection[];
  contextConfig?: ContextConfig | null;
  createdById: string;
  organizationId: string;
  isDefault: boolean;
  usageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
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
  frameworkId: string;
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
  framework?: ContentFramework;
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

export const FRAMEWORK_CATEGORY_LABELS: Record<FrameworkCategory, string> = {
  mutual_action_plan: "Mutual Action Plan",
  pricing_proposal: "Pricing Proposal",
  email: "Email",
  account_plan: "Account Plan",
  executive_summary: "Executive Summary",
  internal_prep_doc: "Internal Prep Doc",
  notes: "Notes",
  general: "General",
  other: "Other",
  business_impact_proposal: "Business Impact Proposal",
};

export const FRAMEWORK_CATEGORY_OPTIONS = Object.entries(FRAMEWORK_CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as FrameworkCategory, label })
);

export const FRAMEWORK_SCOPE_LABELS: Record<FrameworkScope, string> = {
  company: "Company",
  personal: "Personal",
};
