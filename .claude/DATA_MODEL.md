# Data Model Documentation

**Last Updated:** 2025-11-20

This document provides a comprehensive overview of the database schema for the Sales Opportunity Tracker, detailing each model, its purpose, relationships, and field-level descriptions.

---

## Table of Contents

1. [Core Models](#core-models)
   - [Organization](#organization)
   - [User](#user)
   - [Opportunity](#opportunity)
   - [Account](#account)
   - [Contact](#contact)
2. [View & Organization Models](#view--organization-models)
   - [KanbanView](#kanbanview)
   - [KanbanColumn](#kanbancolumn)
   - [OrganizationSettings](#organizationsettings)
3. [Meeting & Notes Models](#meeting--notes-models)
   - [GongCall](#gongcall)
   - [GranolaNote](#granolanote)
   - [GoogleNote](#googlenote)
   - [CalendarEvent](#calendarevent)
4. [Research & Intelligence Models](#research--intelligence-models)
   - [SecFiling](#secfiling)
   - [EarningsCallTranscript](#earningscalltranscript)
   - [ChatMessage](#chatmessage)
5. [Authentication & Access Models](#authentication--access-models)
   - [Invitation](#invitation)
   - [OAuthToken](#oauthtoken)
6. [Enums](#enums)

---

## Core Models

### Organization

**Purpose:** Represents a company/tenant using the application. All data is scoped to an organization for multi-tenancy.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique identifier for the organization |
| `name` | String | Organization's display name |
| `domain` | String? (unique) | Company email domain (e.g., "acme.com") for auto-join functionality |
| `logo` | String? | URL to organization's logo image |
| `fiscalYearStartMonth` | Int | Month when fiscal year starts (1-12, default: 1 = January). Used for quarterly forecasting |
| `createdAt` | DateTime | Timestamp when organization was created |
| `updatedAt` | DateTime | Timestamp of last update (auto-managed) |

**Relationships:**
- Has many: `users`, `opportunities`, `accounts`, `kanbanViews`, `invitations`, `earningsTranscripts`, `secFilings`, `settings`
- **Data Isolation:** All queries must filter by `organizationId` to maintain multi-tenant security

---

### User

**Purpose:** Represents individual users within an organization (sales reps, managers, admins, viewers).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique user identifier |
| `email` | String (unique) | User's email address (used for authentication) |
| `name` | String? | User's display name |
| `avatarUrl` | String? | URL to user's profile picture |
| `supabaseId` | String? (unique) | Links to Supabase Auth user ID |
| `role` | UserRole | Permission level: ADMIN, MANAGER, REP, VIEWER (default: REP) |
| `managerId` | String? | Reference to manager (for hierarchy and data access control) |
| `organizationId` | String? | Organization this user belongs to |
| `createdAt` | DateTime | Account creation timestamp |

**Relationships:**
- Belongs to: `organization` (via `organizationId`), `manager` (via `managerId`)
- Has many: `opportunities` (as owner), `ownedAccounts`, `kanbanViews`, `invitations` (sent), `calendarEvents`, `oauthTokens`, `chatMessages`, `directReports` (users they manage)
- **Permissions:** See [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md) for role-based access control

---

### Opportunity

**Purpose:** Core entity representing a potential sale/deal. Tracks deal stage, value, close date, and associated metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique opportunity identifier |
| `name` | String | Deal name (e.g., "Acme Corp - Enterprise License") |
| `amountArr` | Int | Annual Recurring Revenue in cents (e.g., 50000 = $500.00) |
| `closeDate` | DateTime? | Expected/actual close date |
| `stage` | OpportunityStage | Current stage (discovery, demo, validateSolution, decisionMakerApproval, contracting, closedWon, closedLost) |
| `forecastCategory` | ForecastCategory? | Forecast confidence (pipeline, bestCase, commit, closedWon, closedLost) |
| `confidenceLevel` | Int | 1-5 scale of deal confidence (default: 3) |
| `nextStep` | String? | Next action to progress the deal |
| `notes` | String? | General opportunity notes |
| `riskNotes` | String? | Risk assessment and mitigation notes |
| `accountId` | String? | Links to Account if opportunity is tied to an account |
| `accountName` | String? | Denormalized account name for quick display |
| `ownerId` | String | User who owns this opportunity |
| `organizationId` | String | Organization scope for multi-tenancy |
| `columnId` | String? | Kanban column assignment (for custom views) |
| `quarter` | String? | Target quarter (e.g., "Q1 2025") |
| `cbc` | DateTime? | "Customer Business Case" date |
| `decisionMakers` | String? | Key decision makers identified |
| `competition` | String? | Competitive landscape notes |
| `legalReviewStatus` | ReviewStatus? | Legal review progress (not_started, in_progress, complete, not_applicable) |
| `securityReviewStatus` | ReviewStatus? | Security review progress |
| `businessCaseStatus` | ReviewStatus? | Business case review progress |
| `platformType` | PlatformType? | Platform integration type (oem, api, isv) |
| `pinnedToWhiteboard` | Boolean | Whether opportunity is pinned in whiteboard view (default: false) |
| `accountResearch` | String? | AI-generated account research summary |
| `accountResearchStatus` | AccountResearchStatus? | Status of research generation (generating, completed, failed) |
| `accountResearchGeneratedAt` | DateTime? | Timestamp when research was last generated |
| `goalsHistory` | String? | Historical goals extracted from meetings (deprecated, use consolidatedGoals) |
| `nextStepsHistory` | String? | Historical next steps (deprecated, use consolidated data) |
| `painPointsHistory` | String? | Historical pain points (deprecated, use consolidatedPainPoints) |
| `parsedGongCallIds` | String[] | Array of GongCall IDs that have been parsed |
| `consolidatedGoals` | Json? | Structured goals consolidated from all meetings |
| `consolidatedPainPoints` | Json? | Structured pain points consolidated from all meetings |
| `consolidatedRiskAssessment` | Json? | Consolidated risk factors across all calls |
| `consolidationCallCount` | Int? | Number of calls included in last consolidation |
| `lastConsolidatedAt` | DateTime? | Timestamp of last consolidation |
| `consolidationStatus` | ConsolidationStatus? | Status of consolidation process (idle, processing, completed, failed) |
| `createdAt` | DateTime | Opportunity creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `organization`, `owner` (User), `account` (optional)
- Has many: `contacts`, `gongCalls`, `granolaNotes`, `googleNotes`, `calendarEvents`, `earningsTranscripts`, `chatMessages`
- **Indexes:** `organizationId`, `ownerId`, `accountId`, `columnId`, `closeDate`, `pinnedToWhiteboard`

**Key Features:**
- Uses `confidenceLevel` (1-5 scale), **not** deprecated `probability` field
- Stage names match exact enum values (camelCase, not snake_case)
- All currency stored in cents (integer) for precision
- Supports AI-generated insights via consolidation fields

---

### Account

**Purpose:** Represents a customer or prospect company. Can have multiple opportunities and contacts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique account identifier |
| `name` | String | Company name (unique per organization) |
| `industry` | String? | Industry/vertical (e.g., "SaaS", "Healthcare") |
| `priority` | String | Account priority level (default: "medium") |
| `health` | String | Account health status (default: "good") |
| `website` | String? | Company website URL |
| `ticker` | String? | Stock ticker symbol (for public companies) |
| `notes` | String? | General account notes |
| `ownerId` | String? | Primary account owner (User) |
| `organizationId` | String | Organization scope for multi-tenancy |
| `createdAt` | DateTime | Account creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `organization`, `owner` (User, optional)
- Has many: `opportunities`, `contacts`, `secFilings`, `earningsTranscripts`, `calendarEvents`, `chatMessages`
- **Unique Constraint:** `(organizationId, name)` - account names must be unique within each organization
- **Indexes:** `organizationId`, `ownerId`

**Use Cases:**
- Centralized account management across multiple deals
- Research aggregation (SEC filings, earnings calls)
- Contact relationship mapping (org charts)

---

### Contact

**Purpose:** Represents individuals at customer/prospect companies. Supports org chart visualization with manager relationships.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique contact identifier |
| `firstName` | String | Contact's first name |
| `lastName` | String | Contact's last name |
| `title` | String? | Job title (e.g., "VP of Engineering") |
| `email` | String? | Contact's email address |
| `phone` | String? | Contact's phone number |
| `role` | ContactRole | Role in buying process (decision_maker, influencer, champion, blocker, end_user) |
| `sentiment` | ContactSentiment | Attitude toward your solution (advocate, positive, neutral, negative, unknown - default: unknown) |
| `managerId` | String? | Reference to this contact's manager (for org chart) |
| `positionX` | Float? | X coordinate for org chart visualization |
| `positionY` | Float? | Y coordinate for org chart visualization |
| `notes` | String? | Notes about this contact |
| `opportunityId` | String? | Links to specific opportunity (optional) |
| `accountId` | String? | Links to account (optional) |
| `createdAt` | DateTime | Contact creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `opportunity` (optional), `account` (optional), `manager` (self-referential)
- Has many: `directReports` (contacts they manage)
- **Cascade Delete:** If opportunity or account is deleted, associated contacts are also deleted
- **Indexes:** `opportunityId`, `accountId`

**Use Cases:**
- Org chart visualization using `manager` relationship and `positionX`/`positionY`
- Stakeholder analysis via `role` and `sentiment`
- Contact-level notes and follow-ups

---

## View & Organization Models

### KanbanView

**Purpose:** Configurable Kanban board views. Users can create personal views; admins can create shared organization-wide views.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique view identifier |
| `name` | String | View name (e.g., "My Pipeline", "Q1 Forecast") |
| `viewType` | ViewType | View template type (custom, quarterly, stages, forecast) |
| `isActive` | Boolean | Whether this view is currently selected (default: false) |
| `isDefault` | Boolean | Whether this is the default view for new users (default: false) |
| `isShared` | Boolean | Whether visible to entire organization (default: false) |
| `userId` | String? | Owner user ID (null for shared org views) |
| `organizationId` | String? | Organization ID (for shared views) |
| `lastAccessedAt` | DateTime? | Timestamp when view was last accessed |
| `createdAt` | DateTime | View creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `user` (optional, null for shared views), `organization` (optional)
- Has many: `columns` (KanbanColumn)
- **Unique Constraints:**
  - `(userId, name)` - user view names must be unique per user
  - `(organizationId, name)` - shared view names must be unique per org
- **Indexes:** `(userId, isActive)`, `(organizationId, isActive)`

**View Types:**
- **custom:** User-defined columns (drag-and-drop enabled)
- **quarterly:** Auto-generated columns from close dates (read-only)
- **stages:** Columns based on OpportunityStage enum
- **forecast:** Columns based on ForecastCategory enum

---

### KanbanColumn

**Purpose:** Individual columns within a Kanban view. Defines column title, order, and color.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique column identifier |
| `title` | String | Column display name (e.g., "Discovery", "Q1 2025") |
| `order` | Int | Display order (0-indexed, determines left-to-right positioning) |
| `color` | String? | CSS color value for column header (optional) |
| `viewId` | String | Parent view this column belongs to |
| `createdAt` | DateTime | Column creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `view` (KanbanView)
- **Cascade Delete:** If view is deleted, all columns are deleted
- **Unique Constraint:** `(viewId, order)` - column orders must be unique within a view

**Note:** For quarterly views, columns are generated dynamically and not stored in database (virtual columns).

---

### OrganizationSettings

**Purpose:** Configuration settings for an organization. One-to-one relationship with Organization.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique settings identifier |
| `organizationId` | String (unique) | Organization these settings belong to |
| `defaultKanbanView` | String? | Default view ID for new users |
| `defaultKanbanTemplateId` | String? | Default template to apply for new users (see `/src/lib/templates/column-templates.ts`) |
| `allowSelfSignup` | Boolean | Whether users can sign up without invitation (default: false) |
| `allowDomainAutoJoin` | Boolean | Whether users with matching email domain can auto-join (default: false) |
| `createdAt` | DateTime | Settings creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `organization` (one-to-one)
- **Cascade Delete:** If organization is deleted, settings are deleted

---

## Meeting & Notes Models

### GongCall

**Purpose:** Stores references to Gong.io meeting recordings and parsed insights. Supports AI parsing of transcripts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique call identifier |
| `opportunityId` | String | Opportunity this call relates to |
| `title` | String | Call title/subject |
| `url` | String | Link to Gong.io recording |
| `meetingDate` | DateTime | When the meeting occurred |
| `noteType` | NoteType? | Type of meeting (customer, internal, prospect - default: customer) |
| `transcriptText` | String? | Full transcript text from Gong |
| `parsingStatus` | ParsingStatus? | Status of AI parsing (pending, parsing, completed, failed) |
| `parsedAt` | DateTime? | Timestamp when parsing completed |
| `parsedPeople` | Json? | Array of participants identified in transcript |
| `goals` | Json? | Extracted customer goals from transcript |
| `nextSteps` | Json? | Extracted next steps from transcript |
| `painPoints` | Json? | Extracted pain points from transcript |
| `riskAssessment` | Json? | Identified risks/concerns from transcript |
| `parsingError` | String? | Error message if parsing failed |
| `createdAt` | DateTime | Call record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `opportunity`
- **Cascade Delete:** If opportunity is deleted, all associated Gong calls are deleted
- **Indexes:** `opportunityId`, `parsingStatus`

**AI Processing:**
- Parsed via Google Gemini AI using prompts from `/src/lib/prompts/parse-gong-call.ts`
- Background processing via Inngest workers
- Consolidation logic in `/src/lib/utils/consolidate-insights.ts`

---

### GranolaNote

**Purpose:** Stores references to Granola meeting notes. Lightweight integration without full parsing.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique note identifier |
| `opportunityId` | String | Opportunity this note relates to |
| `title` | String | Note title |
| `url` | String | Link to Granola note |
| `meetingDate` | DateTime | When the meeting occurred |
| `noteType` | NoteType? | Type of meeting (customer, internal, prospect - default: customer) |
| `createdAt` | DateTime | Note record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `opportunity`
- **Cascade Delete:** If opportunity is deleted, all associated Granola notes are deleted
- **Index:** `opportunityId`

---

### GoogleNote

**Purpose:** Stores references to Google Docs meeting notes. Lightweight integration without full parsing.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique note identifier |
| `opportunityId` | String | Opportunity this note relates to |
| `title` | String | Document title |
| `url` | String | Link to Google Doc |
| `createdAt` | DateTime | Note record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `opportunity`
- **Cascade Delete:** If opportunity is deleted, all associated Google notes are deleted
- **Index:** `opportunityId`

---

### CalendarEvent

**Purpose:** Stores calendar events synced from Google Calendar. Supports automatic opportunity/account linking.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique event identifier |
| `userId` | String | User whose calendar this event is from |
| `googleEventId` | String | Google Calendar event ID |
| `summary` | String | Event title |
| `description` | String? | Event description/notes |
| `location` | String? | Meeting location or virtual meeting link |
| `startTime` | DateTime | Event start time |
| `endTime` | DateTime | Event end time |
| `attendees` | String[] | Array of attendee email addresses |
| `isExternal` | Boolean | Whether event includes external (non-org) attendees |
| `organizerEmail` | String? | Email of event organizer |
| `meetingUrl` | String? | Virtual meeting link (Zoom, Meet, etc.) |
| `opportunityId` | String? | Linked opportunity (if auto-detected or manually assigned) |
| `accountId` | String? | Linked account (if auto-detected or manually assigned) |
| `createdAt` | DateTime | Event record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `user`, `opportunity` (optional), `account` (optional)
- **Cascade Delete:** If user is deleted, events are deleted
- **Unique Constraint:** `(userId, googleEventId)` - prevents duplicate event syncing
- **Indexes:** `(userId, startTime)`, `opportunityId`, `accountId`

**Use Cases:**
- Automatic meeting tracking for opportunities
- Timeline visualization of customer interactions
- Meeting frequency analysis

---

## Research & Intelligence Models

### SecFiling

**Purpose:** Stores SEC filings (10-K, 10-Q, 8-K, etc.) for public companies. Supports AI-powered parsing and summarization.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique filing identifier |
| `accountId` | String | Account (company) this filing belongs to |
| `organizationId` | String | Organization scope for multi-tenancy |
| `filingType` | String | Type of filing (e.g., "10-K", "10-Q", "8-K") |
| `filingDate` | DateTime | Date filing was submitted to SEC |
| `fiscalYear` | Int? | Fiscal year of filing |
| `fiscalPeriod` | String? | Fiscal period (e.g., "Q1", "Q2", "FY") |
| `accessionNumber` | String | SEC accession number (unique identifier) |
| `filingUrl` | String | Direct link to SEC filing document |
| `cik` | String | Central Index Key (SEC company identifier) |
| `processingStatus` | FilingProcessingStatus? | Status of AI processing (pending, processing, completed, failed) |
| `processedAt` | DateTime? | Timestamp when processing completed |
| `processingError` | String? | Error message if processing failed |
| `businessOverview` | String? | Extracted business overview section |
| `riskFactors` | Json? | Structured risk factors from filing |
| `financialHighlights` | Json? | Key financial metrics and trends |
| `strategicInitiatives` | String? | Company strategic initiatives and plans |
| `aiSummary` | String? | AI-generated summary of filing |
| `createdAt` | DateTime | Filing record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `account`, `organization`
- **Cascade Delete:** If account or organization is deleted, filings are deleted
- **Unique Constraint:** `(accountId, accessionNumber)` - prevents duplicate filings
- **Indexes:** `organizationId`, `accountId`, `processingStatus`, `filingDate`

**Use Cases:**
- Competitive intelligence gathering
- Account research for sales reps
- Risk factor analysis
- Financial health monitoring

---

### EarningsCallTranscript

**Purpose:** Stores earnings call transcripts for public companies. Supports AI-powered parsing and analysis.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique transcript identifier |
| `accountId` | String | Account (company) this transcript belongs to |
| `opportunityId` | String? | Optional link to specific opportunity |
| `organizationId` | String | Organization scope for multi-tenancy |
| `quarter` | String | Fiscal quarter (e.g., "Q1") |
| `fiscalYear` | Int | Fiscal year of earnings call |
| `callDate` | DateTime | Date of earnings call |
| `title` | String | Call title (e.g., "Q1 2025 Earnings Call") |
| `source` | String | Source of transcript (e.g., "AlphaVantage", "Manual") |
| `sourceUrl` | String? | Link to transcript source |
| `transcriptText` | String? | Full transcript text |
| `processingStatus` | TranscriptProcessingStatus? | Status of AI processing (pending, processing, completed, failed) |
| `processedAt` | DateTime? | Timestamp when processing completed |
| `processingError` | String? | Error message if processing failed |
| `keyQuotes` | Json? | Important quotes from executives |
| `revenueGuidance` | Json? | Financial guidance provided |
| `productAnnouncements` | Json? | New product announcements |
| `competitiveLandscape` | String? | Competitive positioning insights |
| `executiveSentiment` | String? | Overall sentiment analysis |
| `aiSummary` | String? | AI-generated summary of call |
| `createdAt` | DateTime | Transcript record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `account`, `opportunity` (optional), `organization`
- **Cascade Delete:** If account, opportunity, or organization is deleted, transcripts are deleted
- **Unique Constraint:** `(accountId, fiscalYear, quarter)` - one transcript per quarter per company
- **Indexes:** `organizationId`, `accountId`, `opportunityId`, `processingStatus`, `callDate`

**Use Cases:**
- Understand customer's business priorities
- Identify expansion opportunities
- Track strategic initiatives
- Competitive intelligence

---

### ChatMessage

**Purpose:** Stores AI chat conversation history for opportunities and accounts. Enables contextual AI assistant.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique message identifier |
| `opportunityId` | String? | Opportunity this message relates to (if opportunity-level chat) |
| `accountId` | String? | Account this message relates to (if account-level chat) |
| `userId` | String | User who sent the message |
| `role` | String | Message sender role ("user" or "assistant") |
| `content` | String | Message content (text) |
| `contextSize` | Int? | Number of context tokens used for this message |
| `createdAt` | DateTime | Message timestamp |

**Relationships:**
- Belongs to: `opportunity` (optional), `account` (optional), `user`
- **Cascade Delete:** If opportunity, account, or user is deleted, messages are deleted
- **Indexes:** `opportunityId`, `accountId`, `userId`, `createdAt`

**Use Cases:**
- AI-powered opportunity insights
- Contextual account research
- Historical conversation retrieval
- Multi-turn conversations with context

---

## Authentication & Access Models

### Invitation

**Purpose:** Manages user invitations to join an organization. Supports email-based invite flow with expiration.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique invitation identifier |
| `email` | String | Email address of invitee |
| `role` | UserRole | Role to assign when invitation is accepted (default: REP) |
| `organizationId` | String | Organization the user is being invited to |
| `invitedById` | String | User who sent the invitation |
| `token` | String (unique) | Secure token for invitation link |
| `expiresAt` | DateTime | Invitation expiration timestamp |
| `acceptedAt` | DateTime? | Timestamp when invitation was accepted (null if pending) |
| `createdAt` | DateTime | Invitation creation timestamp |

**Relationships:**
- Belongs to: `organization`, `invitedBy` (User)
- **Cascade Delete:** If organization is deleted, invitations are deleted
- **Unique Constraint:** `(organizationId, email)` - one pending invitation per email per org

**Workflow:**
1. Admin/Manager sends invitation via `/api/v1/invitations`
2. Invitee receives email with unique token link
3. Invitee clicks link, creates account via Supabase Auth
4. Backend accepts invitation, creates User record, sets `acceptedAt`

---

### OAuthToken

**Purpose:** Stores OAuth tokens for external service integrations (Google Calendar, etc.). Supports token refresh.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key, unique token identifier |
| `userId` | String | User who authorized this integration |
| `provider` | String | OAuth provider name (e.g., "google") |
| `accessToken` | String | Current access token (encrypted in production) |
| `refreshToken` | String? | Refresh token for renewing access |
| `expiresAt` | DateTime | Access token expiration timestamp |
| `scopes` | String[] | Array of granted OAuth scopes |
| `createdAt` | DateTime | Token creation timestamp |
| `updatedAt` | DateTime | Last update timestamp (auto-managed) |

**Relationships:**
- Belongs to: `user`
- **Cascade Delete:** If user is deleted, OAuth tokens are deleted
- **Unique Constraint:** `(userId, provider)` - one token per provider per user
- **Indexes:** `userId`, `expiresAt`

**Security:**
- Tokens should be encrypted at rest in production
- Automatic token refresh when `expiresAt` is near
- Scopes limit what data can be accessed

---

## Enums

### ContactRole
**Purpose:** Defines a contact's role in the buying process.

| Value | Description |
|-------|-------------|
| `decision_maker` | Has final authority to approve purchase |
| `influencer` | Influences decision but doesn't have final say |
| `champion` | Internal advocate for your solution |
| `blocker` | Opposes or creates obstacles for deal |
| `end_user` | Will use the product/service |

---

### ContactSentiment
**Purpose:** Tracks a contact's attitude toward your solution.

| Value | Description |
|-------|-------------|
| `advocate` | Actively promotes your solution internally |
| `positive` | Generally supportive |
| `neutral` | No strong opinion either way |
| `negative` | Skeptical or opposed |
| `unknown` | Sentiment not yet determined (default) |

---

### ForecastCategory
**Purpose:** Categorizes opportunities by forecast confidence for pipeline management.

| Value | Description |
|-------|-------------|
| `pipeline` | Early stage, low confidence |
| `bestCase` | Moderate confidence, possible to close |
| `commit` | High confidence, expected to close this period |
| `closedWon` | Deal won |
| `closedLost` | Deal lost |

**Used in:** Opportunity forecasting, Kanban "Forecast Categories" view template

---

### NoteType
**Purpose:** Categorizes meeting notes by participant type.

| Value | Description |
|-------|-------------|
| `customer` | Meeting with existing customer (default) |
| `internal` | Internal team meeting |
| `prospect` | Meeting with potential new customer |

---

### OpportunityStage
**Purpose:** Defines the sales process stages for opportunities.

| Value | Description |
|-------|-------------|
| `discovery` | Initial qualification and needs assessment |
| `demo` | Product demonstration phase |
| `validateSolution` | Technical validation and proof of concept |
| `decisionMakerApproval` | Awaiting executive/decision maker approval |
| `contracting` | Negotiating and signing contract |
| `closedWon` | Deal successfully closed |
| `closedLost` | Deal lost to competitor or no decision |

**Used in:** Opportunity stage tracking, Kanban "Sales Stages" view template

---

### PlatformType
**Purpose:** Categorizes how the customer will integrate/use the platform.

| Value | Description |
|-------|-------------|
| `oem` | OEM (Original Equipment Manufacturer) integration |
| `api` | API integration |
| `isv` | ISV (Independent Software Vendor) partnership |

---

### ReviewStatus
**Purpose:** Tracks progress of various review processes (legal, security, business case).

| Value | Description |
|-------|-------------|
| `not_started` | Review not yet begun (default) |
| `in_progress` | Review currently underway |
| `complete` | Review completed |
| `not_applicable` | Review not required for this opportunity |

---

### UserRole
**Purpose:** Defines user permission levels within an organization.

| Value | Description | Permissions |
|-------|-------------|-------------|
| `ADMIN` | Organization administrator | Full access to all org data, can manage users and settings |
| `MANAGER` | Sales manager | Can view/edit own data + direct reports' data |
| `REP` | Sales representative | Can view/edit own data only (default) |
| `VIEWER` | Read-only user | Can view data but cannot edit |

**See:** [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md) for detailed permission matrix

---

### ViewType
**Purpose:** Defines Kanban view template types.

| Value | Description |
|-------|-------------|
| `custom` | User-defined columns (fully customizable) |
| `quarterly` | Auto-generated columns from close dates (read-only) |
| `stages` | Columns based on OpportunityStage enum |
| `forecast` | Columns based on ForecastCategory enum |

---

### AccountResearchStatus
**Purpose:** Tracks AI account research generation status.

| Value | Description |
|-------|-------------|
| `generating` | Research currently being generated |
| `completed` | Research successfully generated |
| `failed` | Research generation encountered an error |

---

### ParsingStatus
**Purpose:** Tracks AI parsing status for GongCall transcripts.

| Value | Description |
|-------|-------------|
| `pending` | Parsing not yet started |
| `parsing` | Currently parsing transcript |
| `completed` | Parsing completed successfully |
| `failed` | Parsing encountered an error |

---

### ConsolidationStatus
**Purpose:** Tracks consolidation of insights across multiple calls/meetings.

| Value | Description |
|-------|-------------|
| `idle` | No consolidation in progress (default) |
| `processing` | Currently consolidating insights |
| `completed` | Consolidation completed successfully |
| `failed` | Consolidation encountered an error |

---

### FilingProcessingStatus
**Purpose:** Tracks AI processing status for SEC filings.

| Value | Description |
|-------|-------------|
| `pending` | Processing not yet started |
| `processing` | Currently processing filing |
| `completed` | Processing completed successfully |
| `failed` | Processing encountered an error |

---

### TranscriptProcessingStatus
**Purpose:** Tracks AI processing status for earnings call transcripts.

| Value | Description |
|-------|-------------|
| `pending` | Processing not yet started |
| `processing` | Currently processing transcript |
| `completed` | Processing completed successfully |
| `failed` | Processing encountered an error |

---

## Key Relationships Diagram

```
Organization (tenant root)
├── Users
│   ├── Opportunities (as owner)
│   ├── Accounts (as owner)
│   ├── KanbanViews (personal)
│   ├── OAuthTokens
│   └── CalendarEvents
├── Opportunities
│   ├── Contacts
│   ├── GongCalls
│   ├── GranolaNotes
│   ├── GoogleNotes
│   ├── EarningsCallTranscripts
│   ├── CalendarEvents
│   └── ChatMessages
├── Accounts
│   ├── Opportunities
│   ├── Contacts
│   ├── SecFilings
│   ├── EarningsCallTranscripts
│   ├── CalendarEvents
│   └── ChatMessages
├── KanbanViews (shared)
│   └── KanbanColumns
├── Invitations
└── OrganizationSettings
```

---

## Multi-Tenancy & Security

**Critical Rules:**
1. **Always scope by `organizationId`** - Every query must filter by organization to prevent data leaks
2. **Cascade deletes** - Deleting an organization removes all associated data
3. **Role-based access** - Check `UserRole` before sensitive operations
4. **Ownership checks** - Verify `ownerId` before edit/delete operations
5. **Shared data** - Only `ADMIN` can create shared Kanban views

**Example Query Pattern:**
```typescript
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId, // ✅ Always include
    ownerId: user.role === 'REP' ? user.id : undefined, // REPs see own data only
  },
});
```

**See:** [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md) for comprehensive security guide

---

## Data Integrity Rules

### Unique Constraints
- `Account.name` - Unique per organization
- `Invitation` - One pending invitation per email per organization
- `User.email` - Globally unique across all organizations
- `EarningsCallTranscript` - One transcript per company per quarter
- `SecFiling` - One filing per accession number per account
- `CalendarEvent` - One event per Google Event ID per user
- `OAuthToken` - One token per provider per user

### Indexes
**Performance-critical indexes:**
- `Opportunity`: `organizationId`, `ownerId`, `accountId`, `columnId`, `closeDate`, `pinnedToWhiteboard`
- `Contact`: `opportunityId`, `accountId`
- `GongCall`: `opportunityId`, `parsingStatus`
- `CalendarEvent`: `(userId, startTime)`, `opportunityId`, `accountId`
- `ChatMessage`: `opportunityId`, `accountId`, `userId`, `createdAt`
- `SecFiling`: `organizationId`, `accountId`, `processingStatus`, `filingDate`
- `EarningsCallTranscript`: `organizationId`, `accountId`, `opportunityId`, `processingStatus`, `callDate`

### Cascade Deletes
When parent entity is deleted, these children are automatically deleted:
- `Organization` → All related data (users, opportunities, accounts, views, etc.)
- `Opportunity` → Contacts, GongCalls, GranolaNotes, GoogleNotes, CalendarEvents, ChatMessages
- `Account` → Contacts, SecFilings, EarningsCallTranscripts, CalendarEvents, ChatMessages
- `KanbanView` → KanbanColumns
- `User` → OAuthTokens, CalendarEvents, ChatMessages

---

## Field Naming Conventions

| Convention | Example | Usage |
|------------|---------|-------|
| `id` | `opportunity.id` | Always CUID primary key |
| `*Id` | `ownerId`, `accountId` | Foreign key references |
| `*At` | `createdAt`, `updatedAt` | Timestamp fields |
| `is*` | `isActive`, `isShared` | Boolean flags |
| `*Status` | `parsingStatus`, `processingStatus` | Enum status fields |
| `*Url` | `avatarUrl`, `filingUrl` | External URLs |
| `*Text` | `transcriptText`, `noteText` | Large text content |
| `*Json` | `riskFactors`, `keyQuotes` | JSON/structured data |
| `amount*` | `amountArr` | Currency amounts (stored in cents) |

---

## Common Query Patterns

### Get User's Opportunities
```typescript
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId,
    ownerId: user.role === 'REP' ? user.id : undefined,
  },
  include: {
    owner: true,
    account: true,
    contacts: true,
  },
  orderBy: { closeDate: 'asc' },
});
```

### Get Account with Research
```typescript
const account = await prisma.account.findUnique({
  where: { id: accountId },
  include: {
    opportunities: true,
    contacts: true,
    secFilings: {
      where: { processingStatus: 'completed' },
      orderBy: { filingDate: 'desc' },
      take: 5,
    },
    earningsTranscripts: {
      where: { processingStatus: 'completed' },
      orderBy: { callDate: 'desc' },
      take: 4,
    },
  },
});
```

### Get Opportunity with All Context
```typescript
const opportunity = await prisma.opportunity.findUnique({
  where: { id: opportunityId },
  include: {
    owner: true,
    account: true,
    contacts: true,
    gongCalls: {
      where: { parsingStatus: 'completed' },
      orderBy: { meetingDate: 'desc' },
    },
    granolaNotes: { orderBy: { meetingDate: 'desc' } },
    calendarEvents: {
      where: { startTime: { gte: new Date() } },
      orderBy: { startTime: 'asc' },
    },
  },
});
```

---

## Migration Best Practices

1. **Always use Prisma migrations** - Never manually modify the database
2. **Test migrations locally first** - Use `npx prisma migrate dev`
3. **Review generated SQL** - Check `prisma/migrations/` folder
4. **Backup before production migrations** - Critical for data safety
5. **Use `@@index` for performance** - Add indexes for frequently queried fields
6. **Use `@@unique` for constraints** - Enforce data integrity at database level
7. **Use `@default` for sensible defaults** - Reduce required fields in forms

**Common Commands:**
```bash
# Generate migration after schema changes
npx prisma migrate dev --name add_field_to_model

# Apply migrations to production
npx prisma migrate deploy

# Reset database (dev only - destructive!)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## Deprecated Fields

These fields are still in the schema but should not be used in new code:

| Field | Model | Replacement | Reason |
|-------|-------|-------------|--------|
| `goalsHistory` | Opportunity | `consolidatedGoals` | Now using structured JSON consolidation |
| `nextStepsHistory` | Opportunity | Use GongCall individual records | Moved to per-call storage |
| `painPointsHistory` | Opportunity | `consolidatedPainPoints` | Now using structured JSON consolidation |

---

## Related Documentation

- [ARCHITECTURE.md](.claude/ARCHITECTURE.md) - System architecture and folder structure
- [API.md](.claude/API.md) - API endpoint specifications
- [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md) - Multi-tenancy and permissions guide
- [INTEGRATIONS.md](.claude/INTEGRATIONS.md) - External service integrations
- [PROMPTS.md](.claude/PROMPTS.md) - AI prompt templates

---

**For questions or updates to this documentation, please update this file and increment the "Last Updated" date.**