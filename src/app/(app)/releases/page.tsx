import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Release Log | Briefcase",
  description: "Development history and release notes",
};

interface Release {
  date: string;
  version?: string;
  title: string;
  highlights: string[];
  changes: string[];
}

const releases: Release[] = [
  {
    date: "2025-12-21",
    version: "0.9.0",
    title: "Business Impact Proposals & Briefs System",
    highlights: [
      "New Business Impact Proposal (BIP) document generation system",
      "Refactored Frameworks to Briefs for clearer terminology",
      "Executive charcoal blue visual refresh",
      "Rebranded to Briefcase with new favicon",
    ],
    changes: [
      "Full-page generate workflow for content creation",
      "Create framework button with query param parsing fixes",
      "Context selection improvements",
      "MAP consolidated into Documents tab",
    ],
  },
  {
    date: "2025-12-20",
    version: "0.8.5",
    title: "Custom AI Frameworks",
    highlights: [
      "Create Framework dialog for custom AI content templates",
      "Unified Documents tab for opportunities",
      "Convert Create Framework from modal to full page",
    ],
    changes: [
      "Improved private company layout in Account Intel",
      "Frameworks tab with pending contacts notification API fix",
    ],
  },
  {
    date: "2025-12-18-19",
    version: "0.8.0",
    title: "Major UI/UX Overhaul",
    highlights: [
      "Linear/Notion-inspired visual overhaul",
      "Redesigned Notes tab with modern timeline-based Call Insights",
      "Gong integration with redesigned Activity section",
      "Two-column layout for Account Intel tab",
    ],
    changes: [
      "Additional context input for business impact proposals",
      "Clickable links to Gong and Granola sources",
      "Component renaming to PascalCase conventions",
      "Table styling for markdown renderer",
    ],
  },
  {
    date: "2025-12-16",
    version: "0.7.5",
    title: "Meeting Management Improvements",
    highlights: [
      "Unlink and move-to-meeting actions for Gong calls and Granola notes",
      "Filter closed opportunities from past quarters",
    ],
    changes: [
      "Improved UI compactness across views",
    ],
  },
  {
    date: "2025-12-09",
    version: "0.7.0",
    title: "Business Impact Proposals",
    highlights: [
      "Business Impact Proposal feature with rich text copy",
      "Account research notifications with real-time updates",
      "Latest call insights summary in simplified timeline",
    ],
    changes: [
      "Improved SEC 10-K section extraction",
      "Reduced polling frequency and improved domain matching",
      "Timezone date handling fixes",
    ],
  },
  {
    date: "2025-12-02-05",
    version: "0.6.5",
    title: "Mutual Action Plans & Calendar Integration",
    highlights: [
      "Mutual Action Plan and Business Case generation",
      "Calendar events in opportunity activity timeline",
      "Forecast category stats and quota attainment dashboard",
      "Real-time notifications for transcript parsing",
    ],
    changes: [
      "Meeting next steps in MAP generation",
      "Why & Why Now and Quantifiable Metrics in insights",
      "Editable fields in contact import",
      "Risk assessment history tracking",
    ],
  },
  {
    date: "2025-11-27-29",
    version: "0.6.0",
    title: "Pagination & Performance",
    highlights: [
      "API pagination across 6+ endpoints",
      "Granola transcript parsing with Gong deduplication",
      "Google Docs-style inline commenting system",
      "Task filtering and inline due date editing",
    ],
    changes: [
      "Defensive array checks for stability",
      "Auth redirect loop fixes",
      "Collapsible calendar event cards",
      "Cache-control headers for CDN",
    ],
  },
  {
    date: "2025-11-24-26",
    version: "0.5.5",
    title: "AI Content Suggestions",
    highlights: [
      "AI-powered content suggestions with Gemini web search",
      "Manual meeting creation and enhanced linking",
      "Incremental calendar sync with sync tokens",
      "Visual comment position indicators",
    ],
    changes: [
      "Rebranded from Opportunity Tracker to DealVibes",
      "React-day-picker v9 upgrade",
      "Floating toolbar for comments",
    ],
  },
  {
    date: "2025-11-20-23",
    version: "0.5.0",
    title: "SEC EDGAR & Earnings Integration",
    highlights: [
      "SEC EDGAR integration for public company filings",
      "Earnings date tracking with automated task reminders",
      "AI chat feature for opportunity analysis",
      "Company name autocomplete with stock ticker",
    ],
    changes: [
      "Automatic opportunity/account matching for calendar events",
      "Improved SEC company search with caching",
      "External calendar events detection improvements",
    ],
  },
  {
    date: "2025-11-13-14",
    version: "0.4.5",
    title: "Forecast Categories & Views",
    highlights: [
      "Current Quarter view with inline editing",
      "Forecast Categories and Sales Stages view grouping",
      "Calendar background sync with persistent storage",
      "Integrations moved to user settings",
    ],
    changes: [
      "Account Research as collapsible section",
      "Markdown rendering for research content",
      "OAuth token expiration fixes",
    ],
  },
  {
    date: "2025-11-10-12",
    version: "0.4.0",
    title: "Google Calendar Integration",
    highlights: [
      "Google Calendar integration with OAuth 2.0",
      "AI-consolidated insights from multiple Gong calls",
      "User management and organization settings UI",
      "Transcript support for Gong calls",
    ],
    changes: [
      "Gemini API resilience with fallback and retry",
      "Inngest timeout and sync fixes",
      "Major codebase cleanup",
    ],
  },
  {
    date: "2025-11-09",
    version: "0.3.5",
    title: "Call Insights & AI Generation",
    highlights: [
      "Editable call insights history with auto-generation",
      "Enhanced AI meeting notes with improved formatting",
      "Inngest for reliable background transcript parsing",
      "Currency input formatting with commas",
    ],
    changes: [
      "Duplicate call insights prevention",
      "Account research formatting improvements",
      "Date picker for close dates",
      "ARR totals in Kanban columns",
    ],
  },
  {
    date: "2025-11-06-08",
    version: "0.3.0",
    title: "Multi-Tenancy & Security",
    highlights: [
      "Organization scoping for all data queries",
      "Complete security and architecture improvements",
      "Confidence levels (1-5) replacing probability",
      "Deal qualification fields",
    ],
    changes: [
      "Prospects page filtering",
      "Whiteboarding page with pinned opportunities",
      "CSV import field support",
      "Role-based navigation improvements",
    ],
  },
  {
    date: "2025-10-13",
    version: "0.2.0",
    title: "Quarterly Views & AI Research",
    highlights: [
      "Quarterly view mode with column templates",
      "AI-powered account research via Gemini",
      "Tabbed layout for opportunity detail page",
      "Inline editing throughout the app",
    ],
    changes: [
      "Meeting dates for calls/notes",
      "Auto-assign opportunities to quarters",
      "Auto-update probability on stage change",
      "Company settings for fiscal year",
    ],
  },
  {
    date: "2025-10-12",
    version: "0.1.5",
    title: "Meeting Integrations",
    highlights: [
      "Supabase authentication with user-scoped data",
      "Gong call recording links",
      "Granola AI meeting notes integration",
      "AI-powered pre-meeting notes generation",
    ],
    changes: [
      "Google Notes linking",
      "Contacts and org chart feature",
      "Editable Kanban columns",
      "Back button for detail pages",
    ],
  },
  {
    date: "2025-10-11",
    version: "0.1.0",
    title: "Initial MVP Release",
    highlights: [
      "Complete opportunity tracking with full CRUD",
      "Drag-and-drop Kanban board",
      "Multi-page navigation (Dashboard, Opportunities, Accounts)",
      "Vercel deployment configuration",
    ],
    changes: [
      "Prisma + PostgreSQL database setup",
      "shadcn/ui component library",
      "API routes with validation",
    ],
  },
  {
    date: "2025-10-07-10",
    version: "0.0.1",
    title: "Project Inception",
    highlights: [
      "Initial project structure",
      "Claude AI instruction configuration",
    ],
    changes: [],
  },
];

export default function ReleasesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">Release Log</h1>
          <p className="mt-2 text-muted-foreground">
            Development history and feature releases for Briefcase
          </p>
        </header>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-0 h-full w-0.5 bg-border" />

          <div className="space-y-12">
            {releases.map((release, index) => (
              <article key={index} className="relative pl-8">
                {/* Timeline dot */}
                <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background" />

                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <time className="text-sm font-medium text-muted-foreground">
                      {release.date}
                    </time>
                    {release.version && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        v{release.version}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-semibold">{release.title}</h2>

                  {release.highlights.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Highlights
                      </h3>
                      <ul className="space-y-1">
                        {release.highlights.map((highlight, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {release.changes.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Other Changes
                      </h3>
                      <ul className="space-y-1">
                        {release.changes.map((change, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="mt-16 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>
            Started October 2025 • Actively developed •{" "}
            {releases.reduce(
              (acc, r) => acc + r.highlights.length + r.changes.length,
              0
            )}{" "}
            features shipped
          </p>
        </footer>
      </div>
    </div>
  );
}
