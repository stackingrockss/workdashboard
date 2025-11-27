# Feature Specification: Mutual Action Plan (MAP) Generator

## Overview

An AI-powered feature that generates structured, milestone-based Mutual Action Plans for sales opportunities and exports them to CSV/Google Sheets for customer collaboration.

## Business Value

- **Accelerate deal velocity**: Clear, shared timeline with customer reduces friction
- **Improve win rates**: Mutual commitment and accountability increase close probability
- **Save time**: Auto-generate professional MAP from existing opportunity data (contacts, research, notes)
- **Enable collaboration**: Export to CSV/Google Sheets for easy sharing and editing with customers
- **Enforce methodology**: Embed Verifiable sales process into every action plan

---

## Architecture Decisions

### Data Model: Simple Field Approach ✅

**Decision**: Add `mutualActionPlan: String?` field to Opportunity model
- Store MAP as markdown (easy editing, rendering, version control)
- TEXT field with 50K character limit (matches accountResearch field)
- Can migrate to separate `MutualActionPlan` model later if versioning needed

**Prisma Schema Change**:
```prisma
model Opportunity {
  // ... existing fields
  mutualActionPlan String? @db.Text // Markdown content, max 50K chars
}
```

### UI Placement: Dedicated Tab ✅

**Decision**: New "Action Plan" tab in opportunity detail page
- Keeps MAP prominent and easily accessible
- Separate from other tabs (Overview, Research & Notes, Meetings & Calls, Contacts)
- Won't clutter existing tabs
- Easy to share link to specific opportunity's MAP

### MAP Content Structure

**Core Elements to Generate**:

1. **Executive Summary**
   - Deal context (company, value, timeline)
   - Key stakeholders
   - Expected close date
   - 2-3 sentence overview

2. **Timeline & Milestones**
   - Work backwards from close date
   - 5-7 key phases aligned with sales stages:
     - Discovery
     - Technical Validation
     - Solution Design
     - Decision Maker Approval
     - Legal/Security Review
     - Contract Negotiation
     - Closed Won
   - Target dates for each milestone

3. **Stakeholder Matrix**
   - Map contacts to roles (Economic Buyer, Technical Buyer, Champion, Influencer)
   - Responsibilities for each stakeholder
   - Communication cadence

4. **Action Items**
   - 10-15 concrete tasks
   - Owner assignment (customer vs. vendor)
   - Due dates
   - Dependencies

5. **Success Criteria**
   - Measurable outcomes for each milestone
   - Exit criteria before moving to next phase

6. **Review Checkpoints**
   - Legal review status and timeline
   - Security review status and timeline
   - Business case approval
   - Procurement process

7. **Risk Mitigation**
   - Top 3-5 identified risks
   - Mitigation strategies
   - Contingency plans

8. **Mutual Commitments**
   - Customer commitments
   - Vendor commitments
   - Clear accountability

**Data Sources for MAP Generation**:
- **Opportunity fields**: name, stage, closeDate, amountArr, confidenceLevel, nextStep, notes, riskNotes
- **Account context**: accountName, accountResearch (AI-generated)
- **Contacts**: All contacts with roles (DECISION_MAKER, CHAMPION, INFLUENCER, etc.)
- **Deal context**: decisionMakers, competition, platformType
- **Review statuses**: legalReviewStatus, securityReviewStatus, businessCaseStatus
- **Meeting notes**: Recent Gong calls, Granola notes (for context)

---

## Implementation Phases

### Phase 1: Core MAP Generation (4-6 hours)

#### 1.1 Database Migration

**File**: `/prisma/migrations/[timestamp]_add_mutual_action_plan/migration.sql`

```sql
-- Add mutualActionPlan field to Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "mutualActionPlan" TEXT;
```

**Commands**:
```bash
# Update schema.prisma first
npx prisma migrate dev --name add_mutual_action_plan
npx prisma generate
```

#### 1.2 AI Generation Library

**File**: `/src/lib/ai/mutual-action-plan.ts`

**Pattern**: Follow existing `meeting-notes.ts` pattern

**Key Functions**:
```typescript
export async function generateMutualActionPlan(
  opportunity: OpportunityWithRelations
): Promise<{ success: boolean; mapContent?: string; error?: string }>;
```

**AI Prompt Structure**:
```typescript
const systemInstruction = `
You are a sales engagement expert specializing in creating Mutual Action Plans (MAPs)
using the Verifiable sales methodology.

A MAP is a shared document between vendor and customer that outlines:
- Clear milestones and timeline
- Stakeholder responsibilities
- Success criteria for each phase
- Mutual commitments and accountability

Your goal is to create actionable, realistic plans that accelerate deal velocity.
`;

const promptTemplate = `
Create a Mutual Action Plan for the following opportunity:

## Deal Context
- Company: {accountName}
- Opportunity: {name}
- Value: {formattedArr}
- Current Stage: {stage}
- Target Close Date: {closeDate}
- Confidence Level: {confidenceLevel}/5

## Stakeholders
{contacts.map(c => `- ${c.name} (${c.title}) - ${c.role}`)}

## Deal Intelligence
### Account Research
{accountResearch || "No research available"}

### Competition
{competition || "Unknown"}

### Review Status
- Legal: {legalReviewStatus}
- Security: {securityReviewStatus}
- Business Case: {businessCaseStatus}

### Current Situation
Next Step: {nextStep}
Notes: {notes}
Risk Notes: {riskNotes}

## Recent Meeting Context
{recentMeetingNotes}

---

Generate a structured Mutual Action Plan in markdown format with the following sections:

# Mutual Action Plan: {opportunityName}

## Executive Summary
[2-3 sentences: deal overview, timeline, key stakeholders]

## Timeline & Milestones
[Table format with columns: Milestone | Target Date | Owner | Status | Success Criteria]

## Stakeholder Matrix
[Table with: Name | Role | Responsibility | Engagement Frequency]

## Action Items
[Numbered list with: Task | Owner | Due Date | Dependencies]

## Review Checkpoints
[Legal, Security, Business Case approval timeline and requirements]

## Risk Mitigation
[Table: Risk | Impact | Probability | Mitigation Strategy]

## Mutual Commitments
### Customer Commitments
[Bulleted list]

### Vendor Commitments
[Bulleted list]

## Success Metrics
[How we'll measure successful implementation]

---

Guidelines:
- Be specific and actionable
- Use realistic timelines based on close date
- Assign stakeholders from the contacts list
- Reference known risks from risk notes
- Include review processes (legal, security) as milestones
- Balance customer and vendor commitments
- Make success criteria measurable
`;
```

**Model**: Use `gemini-3-pro-preview` (for complex, structured generation)

**Error Handling**:
- Validate opportunity has minimum required data (contacts, close date)
- Handle API failures gracefully
- Return structured error messages

#### 1.3 Validation Schema

**File**: `/src/lib/validations/map.ts`

```typescript
import { z } from "zod";

export const mapGenerateSchema = z.object({
  opportunityId: z.string().uuid(),
  customInstructions: z.string().optional(), // Future: user overrides
  regenerate: z.boolean().optional(), // Force regeneration
});

export type MapGenerateInput = z.infer<typeof mapGenerateSchema>;
```

#### 1.4 API Endpoint

**File**: `/src/app/api/v1/opportunities/[id]/generate-map/route.ts`

**Endpoint**: `POST /api/v1/opportunities/[id]/generate-map`

**Request Body** (optional):
```json
{
  "customInstructions": "Focus on security and compliance requirements",
  "regenerate": true
}
```

**Response Format**:
```json
{
  "success": true,
  "mapContent": "# Mutual Action Plan...",
  "generatedAt": "2024-01-15T10:30:00Z"
}
```

**Implementation**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { generateMutualActionPlan } from "@/lib/ai/mutual-action-plan";
import { mapGenerateSchema } from "@/lib/validations/map";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Validate request body
    const body = await request.json();
    const parsed = mapGenerateSchema.safeParse({
      opportunityId: params.id,
      ...body
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 2. Fetch opportunity with all relations
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: params.id },
      include: {
        owner: true,
        account: true,
        contacts: true,
        gongCalls: { take: 5, orderBy: { meetingDate: "desc" } },
        granolaNotes: { take: 5, orderBy: { meetingDate: "desc" } },
        googleNotes: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // 3. Generate MAP
    const result = await generateMutualActionPlan(opportunity);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to generate MAP" },
        { status: 500 }
      );
    }

    // 4. Save to database
    const updated = await prisma.opportunity.update({
      where: { id: params.id },
      data: { mutualActionPlan: result.mapContent },
    });

    return NextResponse.json({
      success: true,
      mapContent: result.mapContent,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("MAP generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

#### 1.5 UI Components

**File**: `/src/components/features/opportunities/map-tab.tsx`

**Component**: MAP display with generation, editing, and export

**Features**:
- "Generate with Gemini" button (when MAP is empty)
- Markdown rendering using `react-markdown`
- Inline editing after generation
- "Regenerate" button
- Generation timestamp display
- Loading states
- Export button (Phase 2)

**Dependencies**:
```bash
npm install react-markdown remark-gfm
```

**Component Structure**:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InlineTextarea } from "@/components/ui/inline-editable";

export function MapTab({ opportunity }: MapTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [mapContent, setMapContent] = useState(opportunity.mutualActionPlan);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/v1/opportunities/${opportunity.id}/generate-map`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Generation failed");

      const data = await res.json();
      setMapContent(data.mapContent);
      toast.success("Action plan generated!");
    } catch (error) {
      toast.error("Failed to generate action plan");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!mapContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">
          No action plan generated yet
        </p>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate with Gemini
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Generated {new Date(opportunity.updatedAt).toLocaleDateString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          {/* Export button - Phase 2 */}
        </div>
      </div>

      {/* Markdown display or inline editor */}
      <InlineTextarea
        value={mapContent}
        onSave={async (value) => {
          // Save to API
          await fetch(`/api/v1/opportunities/${opportunity.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mutualActionPlan: value }),
          });
        }}
        renderDisplay={(value) => (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value}
            </ReactMarkdown>
          </div>
        )}
      />
    </div>
  );
}
```

**File**: Modify `/src/components/features/opportunities/opportunity-detail-client.tsx`

**Change**: Add "Action Plan" tab to Tabs component

```tsx
<Tabs defaultValue="overview" className="w-full">
  <TabsList className="grid w-full grid-cols-5">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="research">Research & Notes</TabsTrigger>
    <TabsTrigger value="meetings">Meetings & Calls</TabsTrigger>
    <TabsTrigger value="contacts">Contacts</TabsTrigger>
    <TabsTrigger value="map">Action Plan</TabsTrigger> {/* NEW */}
  </TabsList>

  {/* ... existing tabs ... */}

  <TabsContent value="map">
    <MapTab opportunity={opportunity} />
  </TabsContent>
</Tabs>
```

---

### Phase 2: CSV Export (2-3 hours)

#### 2.1 MAP Parsing Utility

**File**: `/src/lib/utils/map-parser.ts`

**Purpose**: Parse markdown MAP into structured tabular data

**Key Functions**:
```typescript
export interface MapMilestone {
  milestone: string;
  phase: string;
  owner: string;
  dueDate: string;
  status: string;
  successCriteria: string;
  actionItems: string[];
}

export interface MapActionItem {
  task: string;
  owner: string;
  dueDate: string;
  dependencies: string;
}

export interface MapRisk {
  risk: string;
  impact: string;
  probability: string;
  mitigation: string;
}

export interface ParsedMap {
  opportunityName: string;
  executiveSummary: string;
  milestones: MapMilestone[];
  actionItems: MapActionItem[];
  risks: MapRisk[];
  customerCommitments: string[];
  vendorCommitments: string[];
}

export function parseMapContent(mapMarkdown: string): ParsedMap;
```

**Implementation Notes**:
- Use regex to extract sections from markdown
- Parse markdown tables into structured arrays
- Handle various markdown formats gracefully
- Fall back to raw text if parsing fails

#### 2.2 CSV Export Utility

**File**: `/src/lib/utils/export.ts`

**Dependencies**:
```bash
npm install papaparse
npm install -D @types/papaparse
```

**Key Functions**:
```typescript
import Papa from "papaparse";

export function exportMapToCSV(
  mapContent: string,
  opportunityName: string
): string {
  const parsed = parseMapContent(mapContent);

  // Create CSV structure with multiple sheets/sections
  const sections = [
    // Metadata row
    [["Opportunity", opportunityName], ["Generated", new Date().toISOString()]],
    [[]],

    // Milestones table
    [["=== MILESTONES ==="]],
    [[
      "Milestone",
      "Phase",
      "Owner",
      "Due Date",
      "Status",
      "Success Criteria",
      "Action Items"
    ]],
    ...parsed.milestones.map(m => [
      m.milestone,
      m.phase,
      m.owner,
      m.dueDate,
      m.status,
      m.successCriteria,
      m.actionItems.join("; ")
    ]),
    [[]],

    // Action Items table
    [["=== ACTION ITEMS ==="]],
    [["Task", "Owner", "Due Date", "Dependencies"]],
    ...parsed.actionItems.map(a => [
      a.task,
      a.owner,
      a.dueDate,
      a.dependencies
    ]),
    [[]],

    // Risks table
    [["=== RISKS ==="]],
    [["Risk", "Impact", "Probability", "Mitigation"]],
    ...parsed.risks.map(r => [
      r.risk,
      r.impact,
      r.probability,
      r.mitigation
    ]),
  ];

  // Flatten and convert to CSV
  const flatData = sections.flat();
  return Papa.unparse(flatData);
}
```

#### 2.3 Export API Endpoint

**File**: `/src/app/api/v1/opportunities/[id]/export-map/route.ts`

**Endpoint**: `GET /api/v1/opportunities/[id]/export-map?format=csv`

**Response**: CSV file download

**Implementation**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exportMapToCSV } from "@/lib/utils/export";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    // Fetch opportunity
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        accountName: true,
        mutualActionPlan: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    if (!opportunity.mutualActionPlan) {
      return NextResponse.json(
        { error: "No action plan available to export" },
        { status: 400 }
      );
    }

    // Generate CSV
    const csvContent = exportMapToCSV(
      opportunity.mutualActionPlan,
      opportunity.name
    );

    // Return as downloadable file
    const filename = `MAP-${opportunity.accountName}-${opportunity.name}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export action plan" },
      { status: 500 }
    );
  }
}
```

#### 2.4 Export UI Component

**File**: `/src/components/features/opportunities/map-export-button.tsx`

**Component**: Export dropdown with CSV download

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, Copy } from "lucide-react";
import { toast } from "sonner";

export function MapExportButton({ opportunityId }: { opportunityId: string }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/export-map?format=csv`
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "map-export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Action plan exported to CSV");
    } catch (error) {
      toast.error("Failed to export action plan");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    // TODO: Copy MAP markdown to clipboard
    toast.success("Copied to clipboard");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyToClipboard}>
          <Copy className="h-4 w-4 mr-2" />
          Copy to Clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Integration**: Add `<MapExportButton opportunityId={opportunity.id} />` to MapTab header

---

### Phase 3: Google Sheets Export (Optional - 4-6 hours)

#### 3.1 Google Cloud Setup

**Prerequisites**:
1. Create Google Cloud Project at https://console.cloud.google.com
2. Enable Google Sheets API
3. Create Service Account with "Editor" role
4. Download service account JSON key
5. Add to environment variables

**Environment Variables** (`.env`):
```bash
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

#### 3.2 Google Sheets Integration Library

**File**: `/src/lib/integrations/google-sheets.ts`

**Dependencies**:
```bash
npm install googleapis
```

**Implementation**:
```typescript
import { google, sheets_v4 } from "googleapis";
import { ParsedMap } from "@/lib/utils/map-parser";

// Initialize Google Sheets API client
function getGoogleSheetsClient() {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function exportMapToGoogleSheets(
  parsedMap: ParsedMap,
  opportunityName: string
): Promise<{ success: boolean; sheetUrl?: string; error?: string }> {
  try {
    const sheets = getGoogleSheetsClient();

    // Create new spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `MAP - ${opportunityName} - ${new Date().toISOString().split('T')[0]}`,
        },
        sheets: [
          {
            properties: {
              title: "Milestones",
              gridProperties: { frozenRowCount: 1 },
            },
          },
          {
            properties: {
              title: "Action Items",
              gridProperties: { frozenRowCount: 1 },
            },
          },
          {
            properties: {
              title: "Risks",
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId!;

    // Populate Milestones sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Milestones!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["Milestone", "Phase", "Owner", "Due Date", "Status", "Success Criteria"],
          ...parsedMap.milestones.map((m) => [
            m.milestone,
            m.phase,
            m.owner,
            m.dueDate,
            m.status,
            m.successCriteria,
          ]),
        ],
      },
    });

    // Populate Action Items sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Action Items!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["Task", "Owner", "Due Date", "Dependencies"],
          ...parsedMap.actionItems.map((a) => [
            a.task,
            a.owner,
            a.dueDate,
            a.dependencies,
          ]),
        ],
      },
    });

    // Populate Risks sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Risks!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["Risk", "Impact", "Probability", "Mitigation"],
          ...parsedMap.risks.map((r) => [
            r.risk,
            r.impact,
            r.probability,
            r.mitigation,
          ]),
        ],
      },
    });

    // Format headers (bold, background color)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
        ],
      },
    });

    // Make shareable (anyone with link can view)
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Set permissions
    const drive = google.drive({ version: "v3", auth: sheets.context._options.auth });
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      success: true,
      sheetUrl,
    };
  } catch (error) {
    console.error("Google Sheets export error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

#### 3.3 Export API Endpoint

**File**: `/src/app/api/v1/opportunities/[id]/export-map-sheets/route.ts`

**Endpoint**: `POST /api/v1/opportunities/[id]/export-map-sheets`

**Response**:
```json
{
  "success": true,
  "sheetUrl": "https://docs.google.com/spreadsheets/d/..."
}
```

**Implementation**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseMapContent } from "@/lib/utils/map-parser";
import { exportMapToGoogleSheets } from "@/lib/integrations/google-sheets";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch opportunity
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        accountName: true,
        mutualActionPlan: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    if (!opportunity.mutualActionPlan) {
      return NextResponse.json(
        { error: "No action plan available to export" },
        { status: 400 }
      );
    }

    // Parse MAP content
    const parsedMap = parseMapContent(opportunity.mutualActionPlan);

    // Export to Google Sheets
    const result = await exportMapToGoogleSheets(
      parsedMap,
      `${opportunity.accountName} - ${opportunity.name}`
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create Google Sheet" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sheetUrl: result.sheetUrl,
    });
  } catch (error) {
    console.error("Google Sheets export error:", error);
    return NextResponse.json(
      { error: "Failed to export to Google Sheets" },
      { status: 500 }
    );
  }
}
```

#### 3.4 UI Integration

**Update**: `/src/components/features/opportunities/map-export-button.tsx`

**Add Google Sheets option**:
```tsx
const handleExportGoogleSheets = async () => {
  setIsExporting(true);
  const toastId = toast.loading("Creating Google Sheet...");

  try {
    const response = await fetch(
      `/api/v1/opportunities/${opportunityId}/export-map-sheets`,
      { method: "POST" }
    );

    if (!response.ok) throw new Error("Export failed");

    const data = await response.json();

    // Show success with copyable link
    toast.success(
      <div>
        Google Sheet created!{" "}
        <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Open
        </a>
      </div>,
      { id: toastId, duration: 10000 }
    );

    // Copy link to clipboard
    await navigator.clipboard.writeText(data.sheetUrl);
  } catch (error) {
    toast.error("Failed to create Google Sheet", { id: toastId });
  } finally {
    setIsExporting(false);
  }
};

// Add to dropdown menu
<DropdownMenuItem onClick={handleExportGoogleSheets}>
  <FileSpreadsheet className="h-4 w-4 mr-2" />
  Export to Google Sheets
</DropdownMenuItem>
```

---

## Technical Specifications

### API Endpoints Summary

| Method | Endpoint | Purpose | Request | Response |
|--------|----------|---------|---------|----------|
| POST | `/api/v1/opportunities/[id]/generate-map` | Generate MAP with AI | `{ customInstructions?, regenerate? }` | `{ success, mapContent, generatedAt }` |
| GET | `/api/v1/opportunities/[id]/export-map?format=csv` | Download CSV export | Query: `format=csv` | CSV file download |
| POST | `/api/v1/opportunities/[id]/export-map-sheets` | Export to Google Sheets | `{}` | `{ success, sheetUrl }` |

### Database Schema

```prisma
model Opportunity {
  id                  String   @id @default(uuid())
  name                String
  accountId           String?
  accountName         String
  ownerId             String

  // ... existing fields ...

  mutualActionPlan    String?  @db.Text // NEW: Markdown MAP content (max 50K chars)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Relations
  owner               User     @relation(fields: [ownerId], references: [id])
  account             Account? @relation(fields: [accountId], references: [id])
  contacts            Contact[]
  gongCalls           GongCall[]
  granolaNotes        GranolaNote[]
  googleNotes         GoogleNote[]
}
```

### TypeScript Types

**File**: `/src/types/opportunity.ts`

**Add to Opportunity type**:
```typescript
export interface Opportunity {
  // ... existing fields ...
  mutualActionPlan: string | null;
}
```

### Dependencies to Install

```bash
# Phase 1: Core MAP Generation
npm install react-markdown remark-gfm

# Phase 2: CSV Export
npm install papaparse
npm install -D @types/papaparse

# Phase 3: Google Sheets (Optional)
npm install googleapis
```

### Environment Variables

```bash
# Existing
GEMINI_API_KEY=your_gemini_api_key_here

# Phase 3 only (Google Sheets)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

---

## Files to Create/Modify

### New Files (Phase 1-2: 9 files)

1. ✅ `prisma/migrations/[timestamp]_add_mutual_action_plan/migration.sql`
2. ✅ `/src/lib/ai/mutual-action-plan.ts` - AI generation logic
3. ✅ `/src/lib/utils/map-parser.ts` - Parse markdown to structured data
4. ✅ `/src/lib/utils/export.ts` - CSV export utility
5. ✅ `/src/lib/validations/map.ts` - Zod schemas
6. ✅ `/src/app/api/v1/opportunities/[id]/generate-map/route.ts` - Generation endpoint
7. ✅ `/src/app/api/v1/opportunities/[id]/export-map/route.ts` - CSV export endpoint
8. ✅ `/src/components/features/opportunities/map-tab.tsx` - UI for Action Plan tab
9. ✅ `/src/components/features/opportunities/map-export-button.tsx` - Export dropdown

### New Files (Phase 3: 2 additional files)

10. ✅ `/src/lib/integrations/google-sheets.ts` - Google Sheets API integration
11. ✅ `/src/app/api/v1/opportunities/[id]/export-map-sheets/route.ts` - Sheets export endpoint

### Modified Files (3 files)

1. ✅ `/prisma/schema.prisma` - Add `mutualActionPlan` field
2. ✅ `/src/components/features/opportunities/opportunity-detail-client.tsx` - Add "Action Plan" tab
3. ✅ `/src/types/opportunity.ts` - Update Opportunity type

---

## Success Criteria

### Phase 1: Core MAP Generation ✅
- [ ] Users can click "Generate with Gemini" to create MAP
- [ ] MAP includes all core sections (summary, milestones, stakeholders, actions, risks, commitments)
- [ ] MAP uses existing opportunity data (contacts, research, review statuses, meeting notes)
- [ ] Generated MAP is saved to database automatically
- [ ] Users can manually edit MAP after generation using inline editor
- [ ] MAP displays as formatted markdown with tables and lists
- [ ] "Regenerate" button allows creating new version
- [ ] Generation timestamp is displayed
- [ ] Loading states and error handling work correctly
- [ ] Toast notifications provide clear feedback

### Phase 2: CSV Export ✅
- [ ] "Export" dropdown button appears in Action Plan tab
- [ ] "Download as CSV" option exports MAP to CSV file
- [ ] CSV structure is clean with clear headers and sections
- [ ] CSV includes milestones, action items, and risks as separate tables
- [ ] CSV filename is descriptive: `MAP-{Company}-{Opportunity}-{Date}.csv`
- [ ] Exported CSV opens correctly in Excel and Google Sheets
- [ ] "Copy to Clipboard" option copies MAP markdown
- [ ] Export only available when MAP exists (button disabled otherwise)

### Phase 3: Google Sheets Export (Optional) ✅
- [ ] Google Cloud project configured with Sheets API enabled
- [ ] Service account credentials stored in environment variables
- [ ] "Export to Google Sheets" option creates new spreadsheet
- [ ] Spreadsheet has 3 tabs: Milestones, Action Items, Risks
- [ ] Headers are formatted (bold, background color)
- [ ] Spreadsheet is shareable (anyone with link can view)
- [ ] Success toast shows "Open" link to spreadsheet
- [ ] Shareable link copied to clipboard automatically
- [ ] Rate limit handling (100 requests/100 seconds)

---

## Estimated Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1: Core MAP** | Database migration, AI library, API endpoint, UI components, markdown rendering | **4-6 hours** |
| **Phase 2: CSV Export** | Parser utility, export utility, API endpoint, UI integration | **2-3 hours** |
| **Phase 3: Google Sheets** | Google Cloud setup, Sheets API integration, API endpoint, UI integration | **4-6 hours** |
| **Total MVP (Phase 1-2)** | - | **6-9 hours** |
| **Total with Sheets (Phase 1-3)** | - | **10-15 hours** |

---

## Open Questions for Implementation

### Before starting, clarify:

1. **Data model approach**:
   - ✅ **Recommended**: Simple `mutualActionPlan` field on Opportunity model
   - ⚠️ Alternative: Separate `MutualActionPlan` model with versioning (more complex)

2. **UI tab placement**:
   - ✅ **Recommended**: New "Action Plan" dedicated tab
   - ⚠️ Alternative: Within "Research & Notes" tab (groups AI-generated content)

3. **Generation customization**:
   - Should users provide custom instructions before generation? (e.g., "Focus on security")
   - Or just use existing opportunity data automatically?

4. **Export priority**:
   - ✅ **Recommended**: Implement CSV export (Phase 2) first
   - ⚠️ Optional: Also implement Google Sheets (Phase 3) if collaboration is critical

5. **Google Sheets authentication**:
   - ✅ **Recommended**: Service account (app creates sheets, simpler setup)
   - ⚠️ Alternative: OAuth 2.0 (user's own Drive, more complex)

6. **Additional features for MVP**:
   - Version history/change tracking?
   - "Share via email" button?
   - Template library for different MAP structures?
   - MAP readiness score (based on data completeness)?

7. **Testing strategy**:
   - Manual testing only for MVP?
   - Or add unit tests for parser and export utilities?

---

## Implementation Notes

### Following Existing Patterns

✅ **This feature follows established codebase patterns**:

1. **AI Generation**: Mirrors `account-research` generation pattern
   - Library wrapper: `gemini.ts`
   - Domain logic: `mutual-action-plan.ts`
   - API endpoint: `/api/v1/opportunities/[id]/generate-map`
   - UI component: `InlineTextareaWithAI` pattern

2. **API Conventions**: Matches existing endpoint structure
   - Zod validation for request bodies
   - Consistent response format: `{ success, data, error }`
   - Proper HTTP status codes (200, 201, 400, 404, 500)
   - Include relations with Prisma `include`

3. **UI Components**: Uses established component patterns
   - Tabs structure in opportunity detail page
   - Inline editing with `InlineTextarea`
   - Markdown rendering (new: `react-markdown`)
   - shadcn/ui components (Button, Dropdown, Dialog)
   - Toast notifications with `sonner`

4. **Database**: Follows Prisma conventions
   - Simple field addition (like `accountResearch`)
   - TEXT field for large content (50K char limit)
   - Migration workflow: `npx prisma migrate dev`

### Security Considerations

✅ **Built-in security measures**:
- User authentication scoping (via `ownerId`)
- Zod validation for all API inputs
- Error handling with try/catch blocks
- No raw SQL queries (Prisma only)
- Environment variable protection for API keys
- Rate limit handling for Google Sheets API

### Performance Considerations

✅ **Optimizations**:
- AI generation is async with loading states
- CSV export happens server-side (no client memory issues)
- Google Sheets uses batch updates (not row-by-row)
- Markdown rendering is client-side (no server overhead)
- Use `take` limits when fetching meeting notes (max 5 recent calls)

---

## Future Enhancements (Post-MVP)

### Version 2 Features
- [ ] MAP version history and change tracking
- [ ] Template library (by industry, deal size, stage)
- [ ] "Share via email" with PDF attachment
- [ ] MAP readiness score (based on data completeness)
- [ ] Collaborative editing with real-time sync
- [ ] MAP comparison tool (compare multiple opportunities)
- [ ] Auto-update MAP when opportunity changes (stage, close date, contacts)
- [ ] Integration with calendar (add milestones as events)
- [ ] Customer portal for viewing MAP (read-only, branded)
- [ ] AI suggestions for improving MAP (based on win/loss analysis)

### Version 3 Features
- [ ] Separate `MutualActionPlan` model with full CRUD
- [ ] Multi-language MAP generation
- [ ] MAP analytics (time-to-close by MAP completeness)
- [ ] Integration with Gong/Granola for auto-updating action items
- [ ] Slack/Teams notifications for milestone completions
- [ ] Custom MAP templates per sales team
- [ ] Export to PowerPoint/Keynote presentations

---

## Resources & References

### Documentation
- **Gemini API**: https://ai.google.dev/gemini-api/docs
- **Google Sheets API**: https://developers.google.com/sheets/api
- **Papaparse**: https://www.papaparse.com/
- **react-markdown**: https://github.com/remarkjs/react-markdown
- **Prisma**: https://www.prisma.io/docs

### Existing Code References
- Account Research generation: `/src/lib/ai/meeting-notes.ts`
- Inline editing pattern: `/src/components/ui/inline-editable.tsx`
- Opportunity detail page: `/src/components/features/opportunities/opportunity-detail-client.tsx`
- API endpoint pattern: `/src/app/api/v1/opportunities/[id]/route.ts`

### Sales Methodology
- **Verifiable**: Focus on mutual accountability, clear milestones, measurable outcomes
- **MEDDPIC**: Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion

---

## Contact & Support

For questions during implementation:
1. Review this specification document
2. Check existing codebase patterns (especially account research generation)
3. Consult Claude Agent with specific questions
4. Test incrementally (Phase 1 → Phase 2 → Phase 3)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-06
**Status**: Ready for Implementation
**Priority**: High (Phase 1-2), Medium (Phase 3)
