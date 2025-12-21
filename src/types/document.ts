// Types for the Documents feature
// Unified document model for MAPs, rich text, and AI-generated content

import { MAPActionItem } from "./mutual-action-plan";
import { ContextSelection } from "./brief";
import { BriefCategory } from "@prisma/client";

// Re-export BriefCategory for convenience
export { BriefCategory } from "@prisma/client";

export type DocumentGenerationStatus = "pending" | "generating" | "completed" | "failed";

// Labels for each category
export const BRIEF_CATEGORY_LABELS: Record<BriefCategory, string> = {
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

export const BRIEF_CATEGORY_OPTIONS = Object.entries(BRIEF_CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as BriefCategory, label })
);

// Structured data for MAP documents
export interface MAPStructuredData {
  actionItems: MAPActionItem[];
  sourceCallCount?: number;
  templateContentId?: string;
}

// Loose structured data type for API responses (before validation)
export interface MAPStructuredDataLoose {
  actionItems: unknown[];
  sourceCallCount?: number;
  templateContentId?: string;
}

// Base document interface
export interface Document {
  id: string;
  opportunityId: string;
  organizationId: string;

  // Core fields
  title: string;
  category: BriefCategory;

  // Content - one of these will be populated based on type
  content?: string | null; // Markdown for most categories
  structuredData?: MAPStructuredData | MAPStructuredDataLoose | null; // For MAPs

  // Brief reference (only for AI-generated documents)
  briefId?: string | null;

  // Generation metadata
  generationStatus?: DocumentGenerationStatus | null;
  generatedAt?: Date | string | null;
  generationError?: string | null;
  contextSnapshot?: ContextSelection | Record<string, unknown> | null; // What context was used for generation

  // Versioning
  version: number;
  parentVersionId?: string | null;

  // Audit
  createdById: string;
  lastEditedById?: string | null;
  lastEditedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Relations (populated when included)
  // Partial brief - only includes fields selected by API queries
  brief?: {
    id: string;
    name: string;
    description?: string | null;
    category: BriefCategory;
  } | null;
  createdBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  lastEditedBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  opportunity?: {
    id: string;
    name: string;
    accountName?: string | null;
  };
}

// Document with version history
export interface DocumentWithVersions extends Document {
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

// API request types
export interface CreateDocumentRequest {
  title: string;
  category: BriefCategory;
  content?: string;
  structuredData?: MAPStructuredData;
  // For AI generation
  briefId?: string;
  contextSelection?: ContextSelection;
  // For MAP generation
  generateFromMeetings?: boolean;
  templateContentId?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  structuredData?: MAPStructuredData;
}

export interface RegenerateDocumentRequest {
  contextSelection: ContextSelection;
}

export interface RestoreVersionRequest {
  versionId: string;
}

// List query parameters
export interface DocumentListQuery {
  category?: BriefCategory;
  briefId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// API response types
export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentResponse {
  document: Document;
}

export interface DocumentWithVersionsResponse {
  document: DocumentWithVersions;
}
