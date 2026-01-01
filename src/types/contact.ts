export type ContactRole =
  | "decision_maker"
  | "influencer"
  | "champion"
  | "blocker"
  | "end_user";

export type ContactSentiment =
  | "advocate"
  | "positive"
  | "neutral"
  | "negative"
  | "unknown";

export type EnrichmentStatus =
  | "none"
  | "pending"
  | "enriched"
  | "not_found"
  | "failed";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string; // Computed: firstName + lastName
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  role: ContactRole;
  sentiment: ContactSentiment;
  opportunityId: string;
  managerId?: string | null;
  manager?: Contact | null;
  directReports?: Contact[];
  positionX?: number | null;
  positionY?: number | null;
  notes?: string | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string

  // Enrichment fields (from Hunter.io, People Data Labs, etc.)
  linkedinUrl?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  seniority?: string | null;
  company?: string | null;
  enrichedAt?: string | null;
  enrichmentSource?: string | null;
  enrichmentStatus?: EnrichmentStatus;
}

export interface ContactWithRelations extends Contact {
  manager: Contact | null;
  directReports: Contact[];
}

// For org chart node positioning
export interface ContactPosition {
  id: string;
  x: number;
  y: number;
}

// Role display labels and colors
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  decision_maker: "Decision Maker",
  influencer: "Influencer",
  champion: "Champion",
  blocker: "Blocker",
  end_user: "End User",
};

export const CONTACT_ROLE_COLORS: Record<ContactRole, string> = {
  decision_maker: "border-purple-500",
  influencer: "border-blue-500",
  champion: "border-green-500",
  blocker: "border-red-500",
  end_user: "border-gray-500",
};

// Sentiment display labels and colors
export const CONTACT_SENTIMENT_LABELS: Record<ContactSentiment, string> = {
  advocate: "Advocate",
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  unknown: "Unknown",
};

export const CONTACT_SENTIMENT_COLORS: Record<ContactSentiment, string> = {
  advocate: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  positive: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  neutral: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  negative: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  unknown: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

// Seniority display labels
export const SENIORITY_LABELS: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  entry: "Entry Level",
};

export const SENIORITY_COLORS: Record<string, string> = {
  executive: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  director: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  senior: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  entry: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};
