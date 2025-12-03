// Mutual Action Plan Types
// Matches the user's Google Sheet structure: Target Date | Description | Status | Completion Date | Owner | Notes

export type MAPActionItemStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "delayed";

export const MAP_STATUS_LABELS: Record<MAPActionItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  delayed: "Delayed",
};

export interface MAPActionItem {
  id: string;
  description: string;
  targetDate?: string | null; // ISO date string
  completionDate?: string | null; // ISO date string
  status: MAPActionItemStatus;
  owner: string; // Free text: company name, "Customer", "Both", or specific names
  notes?: string | null;
  order: number;
  isWeeklySync?: boolean; // Flag for recurring sync meetings (styled bold)
}

export type MapGenerationStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed";

export interface MutualActionPlan {
  id: string;
  opportunityId: string;
  version: number;
  generationStatus: MapGenerationStatus;
  generatedAt?: string;
  generationError?: string;
  title?: string;
  actionItems: MAPActionItem[];
  sourceCallCount?: number;
  templateContentId?: string;
  lastEditedById?: string;
  lastEditedAt?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  // Relations (optional, populated when included)
  lastEditedBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  templateContent?: {
    id: string;
    title: string;
  };
}

// API request/response types
export interface GenerateMAPRequest {
  templateContentId?: string; // Optional Content Library template ID
}

export interface UpdateMAPRequest {
  title?: string;
  actionItems?: MAPActionItem[];
}

export interface UpdateActionItemRequest {
  description?: string;
  targetDate?: string | null;
  completionDate?: string | null;
  status?: MAPActionItemStatus;
  owner?: string;
  notes?: string;
  isWeeklySync?: boolean;
}

// For AI generation context
export interface MAPGenerationContext {
  opportunityId: string;
  opportunityName: string;
  accountName?: string;
  stage: string;
  closeDate?: string;
  contacts: Array<{
    name: string;
    title?: string;
    role: string;
  }>;
  meetings: Array<{
    title: string;
    date: string;
    type: "gong" | "granola" | "google" | "calendar";
  }>;
  templateBody?: string; // Template text from Content Library
}

// AI generation output
export interface MAPGenerationResult {
  title: string;
  actionItems: Omit<MAPActionItem, "id">[];
}
