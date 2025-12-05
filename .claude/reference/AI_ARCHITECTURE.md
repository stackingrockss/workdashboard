# AI Architecture & Features Reference

**Last Updated:** 2025-12-04

This document provides a comprehensive reference for all AI features, data flows, and architecture in the Sales Opportunity Tracker.

---

## Table of Contents

1. [AI Provider & Infrastructure](#1-ai-provider--infrastructure)
2. [Feature Summary](#2-feature-summary)
3. [Detailed Feature Reference](#3-detailed-feature-reference)
   - [Sales Call Analysis](#a-sales-call-analysis)
   - [Account Research](#b-account-research)
   - [Contact Classification](#c-contact-classification)
   - [Business Development](#d-business-development)
   - [Financial Intelligence](#e-financial-intelligence)
   - [Content & Enablement](#f-content--enablement)
   - [Conversational AI](#g-conversational-ai)
4. [Background Job Architecture](#4-background-job-architecture)
5. [API Routes](#5-api-routes)
6. [Data Security & Privacy](#6-data-security--privacy)
7. [Model Selection Strategy](#7-model-selection-strategy)
8. [Error Handling & Resilience](#8-error-handling--resilience)
9. [Performance Considerations](#9-performance-considerations)

---

## 1. AI Provider & Infrastructure

### Provider: Google Gemini API

**Core File:** `src/lib/ai/gemini.ts`

**Models Used:**
| Model | Purpose | Use Cases |
|-------|---------|-----------|
| `gemini-3-pro-preview` | Complex reasoning & structured output | Transcript parsing, risk analysis, MAP generation, business cases |
| `gemini-2.0-flash-exp` | Fast financial analysis | Earnings transcripts, SEC filings |
| `gemini-2.5-flash` | Web search enabled | Content suggestions |

**Infrastructure Features:**
- Lazy initialization with `GEMINI_API_KEY` environment variable
- Built-in retry logic with exponential backoff (handles 503 API overload)
- Support for system instructions (model-level context)
- Chat session support for multi-turn conversations
- Streaming response support for real-time UX

---

## 2. Feature Summary

| # | Feature | Purpose | Trigger |
|---|---------|---------|---------|
| 1 | Parse Gong Transcripts | Extract 6 insight types from sales calls | Manual upload |
| 2 | Parse Granola Transcripts | Extract insights from voice notes | Manual upload |
| 3 | Analyze Call Risk | Identify deal risk signals | After parsing |
| 4 | Consolidate Insights | Merge insights from multiple calls | 2+ calls parsed |
| 5 | Generate Account Research | Pre-meeting intelligence | Opportunity creation |
| 6 | Classify Contact Roles | Categorize job titles | After transcript parsing |
| 7 | Generate Mutual Action Plans | Create deal project plans | User request |
| 8 | Generate Business Cases | ROI documentation + discovery questions | User request |
| 9 | Parse Earnings Transcripts | Extract earnings call insights | Transcript upload |
| 10 | Summarize SEC Filings | Analyze 10-K filings | Filing upload |
| 11 | Suggest Content | Recommend sales collateral | User request |
| 12 | Opportunity Chat | Discuss deal strategy | User initiated |
| 13 | Account Chat | Discuss account strategy | User initiated |

---

## 3. Detailed Feature Reference

### A. Sales Call Analysis

#### 1. Parse Gong Call Transcripts

**Files:**
- `src/lib/ai/parse-gong-transcript.ts` (core logic)
- `src/lib/inngest/functions/parse-gong-transcript.ts` (background job)
- `src/app/api/v1/ai/parse-gong-transcript/route.ts` (API)

**Purpose:** Extract 6 types of sales insights from Gong call recordings

**Data Sent to AI:**
```typescript
{
  transcript: string,        // Full transcript (max 80,000 chars)
  organizationName?: string  // For filtering internal participants
}
```

**Data Returned:**
```typescript
{
  painPoints: string[],           // Current problems/frustrations
  goals: string[],                // Desired outcomes
  people: {                       // Participants & mentioned individuals
    name: string,
    title?: string,
    role: ContactRole,
    company?: string
  }[],
  nextSteps: string[],            // Action items with dates
  whyAndWhyNow: string[],         // Business drivers & urgency
  quantifiableMetrics: string[]   // Specific ROI metrics with numbers
}
```

**Prompt Structure:**
- 6 extraction categories with detailed definitions
- Examples for each category
- Rules for handling missing/unclear data
- Contact role auto-classification after extraction

---

#### 2. Parse Granola Note Transcripts

**Files:**
- `src/lib/ai/parse-granola-transcript.ts` (core logic)
- `src/lib/inngest/functions/parse-granola-transcript.ts` (background job)

**Purpose:** Extract sales insights from Granola (voice notes) meeting transcripts

**Data Sent to AI:** Same as Gong parsing

**Data Returned:** Identical structure to Gong parsing

---

#### 3. Analyze Sales Call Risk

**Files:**
- `src/lib/ai/analyze-call-risk.ts` (core logic)
- `src/lib/inngest/functions/analyze-call-risk.ts` (Gong job)
- `src/lib/inngest/functions/analyze-granola-risk.ts` (Granola job)
- `src/app/api/v1/gong-calls/[id]/analyze-risk/route.ts`
- `src/app/api/v1/granola-notes/[id]/analyze-risk/route.ts`

**Purpose:** Identify deal risk signals across 6 categories

**Data Sent to AI:**
```typescript
{
  transcript: string  // Full transcript text
}
```

**Risk Categories Analyzed:**
1. **Budget** - Pricing objections, approval delays, competing priorities
2. **Timeline** - Extended evaluation, postponed meetings, unclear urgency
3. **Competition** - Alternative vendors, RFPs, feature comparisons
4. **Technical** - Integration concerns, security blockers, resource constraints
5. **Alignment** - Lack of sponsor, conflicting priorities, weak champion
6. **Resistance** - Status quo satisfaction, "not the right time", low urgency

**Data Returned:**
```typescript
{
  riskLevel: "low" | "medium" | "high" | "critical",
  riskFactors: {
    category: RiskCategory,
    description: string,      // 1-2 sentences
    severity: "low" | "medium" | "high",
    evidence: string          // Direct quotes or paraphrased
  }[],
  overallSummary: string      // 2-3 sentence deal health assessment
}
```

---

#### 4. Consolidate Multi-Call Insights

**Files:**
- `src/lib/ai/consolidate-call-insights.ts` (core logic)
- `src/lib/inngest/functions/consolidate-insights.ts` (background job)
- `src/app/api/v1/opportunities/[id]/consolidate-insights/route.ts`

**Purpose:** Synthesize insights from 2+ Gong calls AND Granola notes into deduplicated summaries

**Data Sent to AI:**
```typescript
{
  calls: {
    callId: string,
    meetingDate: string,           // ISO format, sorted chronologically
    painPoints: string[],
    goals: string[],
    whyAndWhyNow: string[],
    quantifiableMetrics: string[],
    riskAssessment?: RiskAssessment
  }[]
}
```

**Data Returned:**
```typescript
{
  painPoints: string[],           // Deduplicated, with frequency context
  goals: string[],                // Deduplicated, consolidated
  whyAndWhyNow: string[],         // Deduplicated business drivers
  quantifiableMetrics: string[],  // Deduplicated (preserving exact numbers)
  riskAssessment: {
    riskLevel: RiskLevel,
    riskFactors: RiskFactor[],    // Consolidated by category
    overallSummary: string        // Deal health across all meetings
  }
}
```

**Consolidation Rules:**
- Deduplication of redundant/similar items
- Synthesis of related themes
- Prioritization by significance/frequency
- Temporal context (how urgency changed over time)
- Smart meeting deduplication (Gong priority over Granola)

---

### B. Account Research

#### 5. Generate Pre-Meeting Intelligence

**Files:**
- `src/lib/ai/meeting-notes.ts` (core logic)
- `src/lib/inngest/functions/generate-account-research.ts` (background job)
- `src/app/api/v1/ai/meeting-notes/route.ts`

**Purpose:** Generate comprehensive pre-call research for an account

**Data Sent to AI:**
```typescript
{
  accountName: string,
  companyWebsite?: string,
  stage?: string,
  industry?: string,
  opportunityValue?: number
}
```

**Data Returned:** Markdown document with 10 sections:
1. Business Overview
2. Healthcare & Provider Network Context
3. Recent News & Events
4. Pain Points & Challenges
5. Tech Stack & Current Vendors
6. Competitive Position
7. Decision-Making Context
8. Verifiable-Specific Fit
9. Discovery Questions (5-7 tailored questions)
10. Conversation Starters & Social Proof

> **Note:** Currently hardcoded for Verifiable healthcare product context

---

### C. Contact Classification

#### 6. Classify Contact Roles

**Files:**
- `src/lib/ai/classify-contact-role.ts`

**Purpose:** Classify job titles into structured contact roles

**Data Sent to AI:**
```typescript
{
  roleText: string  // e.g., "VP of Engineering", "Software Engineer"
}
```

**Data Returned:**
```typescript
{
  role: "decision_maker" | "influencer" | "champion" | "blocker" | "end_user"
}
```

**Classification Rules:**
| Role | Description |
|------|-------------|
| `decision_maker` | C-level, VPs, Directors with budget authority |
| `influencer` | Managers, team leads, senior ICs who shape decisions |
| `champion` | Internal advocates pushing for the solution |
| `blocker` | People opposing or creating obstacles |
| `end_user` | Individual contributors using the product |

---

### D. Business Development

#### 7. Generate Mutual Action Plans (MAPs)

**Files:**
- `src/lib/ai/generate-mutual-action-plan.ts` (core logic)
- `src/lib/inngest/functions/generate-map.ts` (background job)
- `src/app/api/v1/opportunities/[id]/mutual-action-plan/route.ts`

**Purpose:** Create collaborative project plan working backward from deal close date

**Data Sent to AI:**
```typescript
{
  opportunity: {
    name: string,
    accountName: string,
    stage: string,
    closeDate: string,
    opportunityId: string
  },
  meetings: {
    date: string,
    title: string,
    type: string,
    attendees: string[],      // Email addresses
    nextSteps: string[]
  }[],
  contacts: {
    name: string,
    title: string,
    role: ContactRole
  }[],
  template?: MutualActionPlan   // Previous MAP as guide (optional)
}
```

**Data Returned:**
```typescript
{
  title: string,              // "Account Name + Company | Partnership Project Plan"
  actionItems: {
    description: string,
    targetDate: string,       // YYYY-MM-DD
    status: "not_started" | "in_progress" | "completed" | "delayed",
    owner: string,            // "Customer", company name, "Both", or person
    notes?: string,
    isWeeklySync?: boolean
  }[]                         // 10-20 items
}
```

**Generation Rules:**
- Works backward from close date with realistic timelines
- Includes tasks for both customer and seller
- Process flow: Discovery → Demo → Technical → Security → Legal → Contract
- Weekly check-in meetings throughout
- Incorporates meeting "Next Steps" as real agreed commitments
- 2-4 weeks for security/legal review phases

---

#### 8. Generate Business Cases

**Files:**
- `src/lib/ai/generate-business-case.ts` (core logic)
- `src/app/api/v1/ai/business-case/route.ts`

**Purpose:** Create compelling business cases + discovery questions

**Data Sent to AI:**
```typescript
{
  opportunity: {
    name: string,
    amountArr: number,
    stage: string,
    confidenceLevel: number,
    competition?: string,
    platformType?: string,
    consolidatedPainPoints: string[],
    consolidatedGoals: string[],
    accountResearch?: string
  },
  account: {
    name: string,
    industry?: string,
    website?: string
  },
  contacts: {
    firstName: string,
    lastName: string,
    title?: string,
    role?: ContactRole,
    sentiment?: string
  }[],
  priorExamples?: string[]    // Previous business cases for learning
}
```

**Data Returned:** Two markdown documents:

**1. Business Case (800-1200 words):**
- Executive Summary
- Current State & Challenges
- Proposed Solution
- Expected Business Outcomes
- ROI Analysis (with markdown table)
- Implementation Roadmap
- Next Steps

**2. Discovery Questions:**
- Quantifying Current Pain (3-5 questions)
- Financial Impact (3-5 questions)
- Time & Efficiency (3-5 questions)
- Risk & Compliance (3-5 questions)

---

### E. Financial Intelligence

#### 9. Parse Earnings Call Transcripts

**Files:**
- `src/lib/ai/parse-earnings-transcript.ts` (core logic)
- `src/lib/inngest/functions/process-earnings-transcript.ts` (background job)

**Purpose:** Extract key insights from earnings calls for sales context

**Data Sent to AI:**
```typescript
{
  transcript: string  // First 30,000 chars (truncated for token limits)
}
```

**Data Returned:**
```typescript
{
  keyQuotes: string[],           // Top 5-7 exec quotes with speaker names
  revenueGuidance: string[],     // Forward-looking revenue statements
  productAnnouncements: string[], // New products/features/partnerships
  competitiveLandscape: string,  // Market share & competitive commentary
  executiveSentiment: "positive" | "cautious" | "negative",
  fullSummary: string            // 1-paragraph summary for sales teams
}
```

**Model:** `gemini-2.0-flash-exp` (optimized for financial analysis)

---

#### 10. Summarize SEC Filings

**Files:**
- `src/lib/ai/summarize-sec-filing.ts` (core logic)
- `src/lib/inngest/functions/process-sec-filing.ts` (background job)

**Purpose:** Analyze 10-K filings for financial and strategic insights

**Data Sent to AI:**
```typescript
{
  sections: {
    business: string,      // Business overview section
    riskFactors: string,   // Risk factors section
    mdAndA: string         // Management Discussion & Analysis
  }
}
```

**Data Returned:**
```typescript
{
  businessOverview: string,      // 2-3 sentences on business & market
  riskFactors: string[],         // Top 5-10 material risks
  financialHighlights: {
    revenue: string,
    profitability: string,
    trends: string
  },
  strategicInitiatives: string,  // 2-3 sentences on major plans
  fullSummary: string            // 1-paragraph comprehensive summary
}
```

**Model:** `gemini-2.0-flash-exp` (optimized for financial analysis)

---

### F. Content & Enablement

#### 11. Suggest Relevant Content

**Files:**
- `src/lib/ai/content-suggestion.ts` (core logic)
- `src/app/api/v1/opportunities/[id]/content/suggest/route.ts`

**Purpose:** Recommend sales collateral based on opportunity context

**Data Sent to AI:**
```typescript
{
  query: string,                  // What content they need
  opportunity: {
    name: string,
    account: string,
    stage: string,
    painPoints: string[],
    goals: string[]
  },
  accountResearch?: string,
  contentLibrary: {               // Full internal content library
    id: string,
    title: string,
    url: string,
    contentType: string,
    description: string,
    body: string
  }[]
}
```

**Data Returned:** Embedded content cards in response:
```typescript
{
  suggestions: {
    source: "internal" | "web",
    id?: string,                  // Only for internal content
    title: string,
    url: string,
    contentType: "case_study" | "blog_post" | "whitepaper" | "video" | "webinar" | "other",
    description: string,          // Max 150 chars
    relevanceReason: string
  }[]                             // 5-7 suggestions max
}
```

**Model:** `gemini-2.5-flash` (web search enabled)

---

### G. Conversational AI

#### 12. Opportunity Chat Assistant

**Files:**
- `src/app/api/v1/opportunities/[id]/chat/route.ts` (streaming API)
- `src/lib/ai/chat-context.ts` (context builder)

**Purpose:** Multi-turn chat about opportunity status, risks, and strategy

**Data Sent to AI:**
```typescript
{
  systemPrompt: string,           // Sales assistant role definition
  context: {                      // Max ~10,000 chars
    opportunity: {
      name: string,
      amount: number,
      stage: string,
      confidence: number
    },
    account: {
      name: string,
      industry: string,
      health: string,
      ticker?: string
    },
    contacts: {
      name: string,
      title: string,
      role: string,
      sentiment: string
    }[],
    recentCalls: {                // Up to 5 calls with parsed insights
      date: string,
      insights: CallInsights
    }[],
    upcomingEvents: CalendarEvent[], // Up to 5 events
    earningsData?: EarningsInsights,
    secFilings?: FilingSummary
  },
  messageHistory: Message[]       // Multi-turn conversation
}
```

**Special Features:**
- Streaming responses for real-time UX
- Rate limiting per user
- Auto-detects content suggestion requests and delegates appropriately

---

#### 13. Account Chat Assistant

**Files:**
- `src/app/api/v1/accounts/[id]/chat/route.ts`

**Purpose:** Discuss account-level strategy and growth opportunities

**Data Sent to AI:** Similar structure to opportunity chat, but account-focused context

---

## 4. Background Job Architecture

### Event-Driven Processing with Inngest

All heavy AI work runs asynchronously via Inngest background jobs.

**Job Pipeline:**
```
User Action (upload/create)
        ↓
API Trigger → Inngest Event
        ↓
Background Job Starts (status: "processing")
        ↓
AI Analysis (1+ Gemini calls)
        ↓
Result Saved to Database
        ↓
Job Complete (status: "completed" or "failed")
```

**Jobs & Events:**

| Job | Event | Trigger | AI Work |
|-----|-------|---------|---------|
| `parseGongTranscriptJob` | `gong/transcript.parse` | Manual upload | Parse Gong call |
| `parseGranolaTranscriptJob` | `granola/transcript.parse` | Manual upload | Parse Granola note |
| `analyzeCallRiskJob` | `gong/risk.analyze` | Parse completes | Risk analysis (Gong) |
| `analyzeGranolaRiskJob` | `granola/risk.analyze` | Parse completes | Risk analysis (Granola) |
| `consolidateInsightsJob` | `gong/insights.consolidate` | 2+ calls parsed | Consolidate insights |
| `generateMapJob` | `map/generate` | User request | Generate MAP |
| `generateAccountResearchJob` | `opportunity/research.generate` | Opp created | Account research |
| `processEarningsTranscriptJob` | `earnings/transcript.process` | Transcript upload | Parse earnings |
| `processSecFilingJob` | `sec/filing.process` | Filing upload | Summarize filing |

**Job Features:**
- Automatic retry (typically 3 retries) with exponential backoff
- Concurrency limits to avoid API rate limits
- Status tracking in database

---

## 5. API Routes

### AI-Specific Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/v1/ai/parse-gong-transcript` | Trigger Gong parsing |
| `POST` | `/api/v1/ai/meeting-notes` | Generate pre-meeting notes |
| `POST` | `/api/v1/ai/business-case` | Generate business case |
| `POST` | `/api/v1/ai/test` | Test Gemini connectivity |

### Opportunity AI Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/v1/opportunities/[id]/chat` | Opportunity chat (streaming) |
| `POST` | `/api/v1/opportunities/[id]/consolidate-insights` | Consolidate insights |
| `POST` | `/api/v1/opportunities/[id]/mutual-action-plan` | Generate/update MAP |

### Call/Note Analysis Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/v1/gong-calls/[id]/analyze-risk` | Analyze Gong call risk |
| `POST` | `/api/v1/granola-notes/[id]/analyze-risk` | Analyze Granola note risk |

### Account Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/v1/accounts/[id]/chat` | Account chat (streaming) |

---

## 6. Data Security & Privacy

### What IS Sent to Gemini API

- Full transcript text (Gong, Granola, earnings, SEC)
- Structured opportunity/account context (names, pain points, goals)
- Internal content library (for content suggestions)
- Contact names and titles

### What is NOT Sent to Gemini API

- Passwords or authentication tokens
- API keys or credentials
- Database connection strings
- User email addresses (except as meeting attendees)
- Financial account numbers

### Multi-Tenancy Security

- All queries filtered by `organizationId`
- Auth required on sensitive endpoints
- Opportunity ownership verified before processing
- Transcripts stored in database (can be deleted)

---

## 7. Model Selection Strategy

| Model | Strengths | Used For |
|-------|-----------|----------|
| `gemini-3-pro-preview` | Complex reasoning, nuanced extraction, structured JSON | Transcript parsing, risk analysis, consolidation, MAP, business cases, contact classification |
| `gemini-2.0-flash-exp` | Speed-optimized, financial domain | Earnings transcripts, SEC filings |
| `gemini-2.5-flash` | Web search capability | Content suggestions |

---

## 8. Error Handling & Resilience

### Retry Strategy

```typescript
// Automatic retry on 503 "Service Unavailable"
// Exponential backoff: 3s → 6s → 12s (+ random jitter 0-2s)
// Max retries: 3 (configurable per feature)
// Non-503 errors: Immediate failure, no retry
```

### Status Tracking

```
pending → parsing/processing → completed
                            → failed (with error message)
```

- Error messages stored in database for user reference
- Manual "Retry Failed Parse" option available
- Failed jobs don't block opportunity progress

---

## 9. Performance Considerations

### Token/Size Limits

| Content Type | Limit | Handling |
|--------------|-------|----------|
| Gong/Granola transcripts | 80,000 chars | Truncated |
| Earnings transcripts | 30,000 chars | Truncated |
| SEC filings | Extracted sections | HTML removed |
| Business case examples | 4,000 chars each | Truncated |
| Account research | 3,000 chars | Truncated |
| Chat context | ~10,000 chars | Selective inclusion |

### Rate Limiting

- Chat endpoint: Rate limited per user
- Risk analysis: Concurrency limited to 3 parallel jobs
- Content suggestions: Sequential processing

### Caching

- No explicit AI response caching
- Database stores all parsed results for reuse
- Prior business cases used as learning examples

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GEMINI_CHAT_MODEL` | Override chat model | No (default: gemini-3-pro-preview) |
| `INNGEST_EVENT_KEY` | Inngest webhook signing | Yes (for background jobs) |

---

## File Reference

### Core AI Files

```
src/lib/ai/
├── gemini.ts                    # Gemini client & retry logic
├── parse-gong-transcript.ts     # Gong transcript parsing
├── parse-granola-transcript.ts  # Granola transcript parsing
├── analyze-call-risk.ts         # Risk analysis
├── consolidate-call-insights.ts # Multi-call consolidation
├── meeting-notes.ts             # Pre-meeting research
├── classify-contact-role.ts     # Contact role classification
├── generate-mutual-action-plan.ts # MAP generation
├── generate-business-case.ts    # Business case generation
├── parse-earnings-transcript.ts # Earnings call parsing
├── summarize-sec-filing.ts      # SEC filing analysis
├── content-suggestion.ts        # Content recommendations
└── chat-context.ts              # Chat context builder
```

### Background Jobs

```
src/lib/inngest/functions/
├── parse-gong-transcript.ts
├── parse-granola-transcript.ts
├── analyze-call-risk.ts
├── analyze-granola-risk.ts
├── consolidate-insights.ts
├── generate-map.ts
├── generate-account-research.ts
├── process-earnings-transcript.ts
└── process-sec-filing.ts
```

### API Routes

```
src/app/api/v1/
├── ai/
│   ├── parse-gong-transcript/route.ts
│   ├── meeting-notes/route.ts
│   ├── business-case/route.ts
│   └── test/route.ts
├── opportunities/[id]/
│   ├── chat/route.ts
│   ├── consolidate-insights/route.ts
│   └── mutual-action-plan/route.ts
├── gong-calls/[id]/
│   └── analyze-risk/route.ts
├── granola-notes/[id]/
│   └── analyze-risk/route.ts
└── accounts/[id]/
    └── chat/route.ts
```