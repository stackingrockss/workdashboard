# External Integrations & AI Guidelines

> Gong, Granola, Google Notes, and Gemini AI integration patterns

---

## 🤖 AI Integration (Google Gemini)

### Overview

This app uses Google's Gemini AI for:
- **Meeting note parsing** - Extract pain points, goals, next steps from transcripts
- **Risk analysis** - Assess deal risks from call transcripts
- **Account research** - Generate executive summaries and meeting briefs
- **Insight consolidation** - Aggregate insights from multiple calls

**Library:** `@google/generative-ai`
**API Key:** `GOOGLE_AI_API_KEY` (environment variable)

---

### Configuration

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
```

**Models:**
- Use `gemini-1.5-pro` for complex analysis (meeting parsing, research)
- Use `gemini-1.5-flash` for simpler tasks (categorization, summarization)

---

### Meeting Note Parsing

**Endpoint:** `POST /api/v1/ai/meeting-notes`

**Input:**
```json
{
  "noteText": "Full meeting transcript or notes...",
  "opportunityId": "cuid"
}
```

**Process:**
1. Send transcript to Gemini with structured prompt
2. Request JSON output with specific schema
3. Parse response for pain points, goals, next steps, people
4. Store in database (GongCall, GranolaNote, or Opportunity fields)

**Prompt Template:**
```
You are a sales assistant analyzing a customer meeting transcript.

Extract the following information in JSON format:
{
  "painPoints": ["list of customer pain points and challenges"],
  "goals": ["list of customer goals and objectives"],
  "nextSteps": ["list of agreed-upon action items"],
  "people": ["list of people mentioned in the meeting"]
}

Transcript:
${transcriptText}

Return only valid JSON.
```

**Error Handling:**
- Wrap API calls in `try/catch`
- Set `parsingStatus` to `failed` on error
- Store error message in `parsingError` field
- Allow manual retry via `POST /api/v1/gong-calls/[id]/retry-parsing`

---

### Gong Transcript Parsing

**Endpoint:** `POST /api/v1/ai/parse-gong-transcript`

**Background Job:** Uses Inngest for async processing

**Workflow:**
1. User creates GongCall with transcript
2. `parsingStatus` set to `pending`
3. Inngest job triggered
4. Update status to `parsing`
5. Call Gemini API with transcript
6. Parse response
7. Update GongCall with parsed data
8. Set status to `completed` or `failed`

**Enhanced Prompt (with risk analysis):**
```
You are a sales assistant analyzing a Gong sales call transcript.

Extract structured information and assess deal risks.

Return JSON:
{
  "painPoints": ["customer pain points"],
  "goals": ["customer goals"],
  "nextSteps": ["action items with owners and deadlines"],
  "parsedPeople": [
    {
      "name": "John Doe",
      "title": "VP Engineering",
      "sentiment": "positive" | "neutral" | "negative"
    }
  ],
  "riskAssessment": {
    "overallRisk": "low" | "medium" | "high",
    "riskFactors": [
      {
        "category": "budget" | "timeline" | "competition" | "stakeholder" | "technical",
        "severity": "low" | "medium" | "high",
        "description": "specific risk description",
        "mitigation": "suggested mitigation strategy"
      }
    ],
    "redFlags": ["critical warning signs"],
    "strengths": ["positive indicators"]
  }
}

Transcript:
${transcriptText}
```

**Retry Logic:**
- Max 3 retries with exponential backoff
- If stuck in `parsing` for > 10 minutes, mark as `failed`
- Admin endpoint to retry all stuck jobs: `POST /api/v1/admin/retry-stuck-parsing`

---

### Account Research Generation

**Trigger:** User clicks "Generate Research" on opportunity detail page

**Workflow:**
1. Update `accountResearchStatus` to `generating`
2. Trigger background job (Inngest)
3. Fetch account data (website, industry, opportunity details)
4. Call Gemini with research prompt
5. Store result in `accountResearch` field (plain text/markdown)
6. Set status to `completed`

**Research Prompt:**
See `/src/lib/ai/meeting-notes.ts` for the full Gemini prompt and system instructions.

The prompt generates comprehensive background research including:
- Business overview and financial context
- Provider network size and healthcare context
- Recent news and strategic initiatives
- Pain points and challenges
- Tech stack and current vendors
- Competitive position
- Decision-making context
- Verifiable-specific fit analysis
- Discovery questions
- Conversation starters and social proof

**Output Format:**
Plain text/markdown stored in `accountResearch` field. No structured metadata or mobile-optimized format.

**Display:**
- Use `react-markdown` with `remark-gfm` for rendering
- Show timestamp: `formatDateShort(accountResearchGeneratedAt)`
- Add "Regenerate" button (only for ADMIN/MANAGER/owner)

---

### Insight Consolidation

**Purpose:** Aggregate insights from multiple Gong calls into a single summary

**Trigger:** `POST /api/v1/opportunities/[id]/consolidate-insights`

**Process:**
1. Fetch all completed GongCalls for opportunity
2. Extract all `painPoints`, `goals`, `riskAssessment` data
3. Send to Gemini for consolidation
4. Store in `consolidatedPainPoints`, `consolidatedGoals`, `consolidatedRiskAssessment`
5. Update `lastConsolidatedAt` and `consolidationCallCount`

**Consolidation Prompt:**
```
You are analyzing multiple sales call transcripts for the same opportunity.

Consolidate the following data into a unified summary:

Pain Points from ${callCount} calls:
${painPointsFromAllCalls}

Goals from ${callCount} calls:
${goalsFromAllCalls}

Risk Assessments from ${callCount} calls:
${riskAssessmentsFromAllCalls}

Return JSON:
{
  "consolidatedPainPoints": [
    "unique pain points, deduplicated and prioritized by frequency"
  ],
  "consolidatedGoals": [
    "unique goals, deduplicated and prioritized"
  ],
  "consolidatedRiskAssessment": {
    "overallRisk": "low" | "medium" | "high",
    "topRisks": [
      {
        "category": string,
        "description": string,
        "mitigation": string,
        "mentionedInCalls": number
      }
    ],
    "trends": [
      "insights about how sentiment/risk has changed over time"
    ]
  }
}

Deduplicate similar items and prioritize by frequency/importance.
```

**Auto-Consolidation:**
- Consider auto-consolidating when new Gong call is parsed
- Or on a schedule (daily for active opportunities)

---

## 🎙️ Gong Integration

### Overview

Gong is a sales intelligence platform that records and analyzes sales calls.

**Model:** `GongCall`
**API Endpoints:**
- `POST /api/v1/opportunities/[id]/gong-calls` - Link a call
- `GET /api/v1/opportunities/[id]/gong-calls` - List calls
- `DELETE /api/v1/opportunities/[id]/gong-calls/[callId]` - Remove link
- `POST /api/v1/gong-calls/[id]/retry-parsing` - Retry failed parse
- `POST /api/v1/gong-calls/[id]/analyze-risk` - Run risk analysis

---

### Linking Gong Calls

**User Flow:**
1. User copies Gong call URL from Gong app
2. Clicks "Add Gong Call" on opportunity
3. Pastes URL, enters title, meeting date
4. (Optional) Pastes full transcript text
5. Submits form

**Form Fields:**
```typescript
{
  title: string;           // e.g., "Discovery Call with Acme"
  url: string;             // Gong call URL (must be valid https://app.gong.io/call?id=...)
  meetingDate: DateTime;   // When the call happened
  noteType: "customer" | "internal" | "prospect";
  transcriptText?: string; // Optional: full transcript for parsing
}
```

**Validation:**
- URL must be from `app.gong.io`
- Meeting date cannot be in the future
- Title required (2-200 chars)

---

### Automatic Transcript Parsing

If `transcriptText` is provided:
1. GongCall created with `parsingStatus: 'pending'`
2. Inngest job triggered
3. Job calls `POST /api/v1/ai/parse-gong-transcript`
4. Gemini parses transcript
5. Results stored in GongCall record
6. Status updated to `completed` or `failed`

**Parsed Fields:**
- `painPoints` (JSON array)
- `goals` (JSON array)
- `nextSteps` (JSON array)
- `parsedPeople` (JSON array)
- `riskAssessment` (JSON object)
- `parsedAt` (timestamp)

---

### Displaying Gong Calls

**List View (on Opportunity Detail):**
- Show all calls sorted by `meetingDate` desc
- Display title, date, noteType badge
- Show parsing status indicator:
  - ✅ Completed (green)
  - ⏳ Pending/Parsing (blue spinner)
  - ❌ Failed (red with retry button)
- Link to Gong URL (opens in new tab)

**Detail View (expandable):**
- Show parsed pain points, goals, next steps
- Show parsed people with sentiment
- Show risk assessment (if available)
- Show full transcript (collapsible)

---

### Manual Transcript Entry

If user doesn't have transcript at time of creation:
1. Create GongCall without `transcriptText`
2. `parsingStatus` is `null` (not parsed)
3. Later, user can edit and add transcript
4. PATCH endpoint updates `transcriptText` and sets `parsingStatus: 'pending'`
5. Parsing begins automatically

---

## 📝 Granola Integration

### Overview

Granola is an AI-powered meeting notes tool.

**Model:** `GranolaNote`
**API Endpoints:**
- `POST /api/v1/opportunities/[id]/granola-notes` - Link a note
- `GET /api/v1/opportunities/[id]/granola-notes` - List notes
- `DELETE /api/v1/opportunities/[id]/granola-notes/[noteId]` - Remove link

---

### Linking Granola Notes

**User Flow:**
1. User shares Granola note (generates public URL)
2. Clicks "Add Granola Note" on opportunity
3. Pastes URL, enters title, meeting date
4. Submits form

**Form Fields:**
```typescript
{
  title: string;         // e.g., "QBR with Acme"
  url: string;           // Granola note URL (https://granola.so/notes/...)
  meetingDate: DateTime; // When the meeting happened
  noteType: "customer" | "internal" | "prospect";
}
```

**Validation:**
- URL must be from `granola.so`
- Meeting date cannot be in the future
- Title required (2-200 chars)

---

### Displaying Granola Notes

**List View:**
- Show all notes sorted by `meetingDate` desc
- Display title, date, noteType badge
- Link to Granola URL (opens in new tab)
- Show meeting type icon (customer/internal/prospect)

**No Parsing:**
Granola notes are not parsed by AI in this app. Users view them directly in Granola.

---

## 📄 Google Notes Integration

### Overview

Google Docs/Sheets links for meeting notes or research documents.

**Model:** `GoogleNote`
**API Endpoints:**
- `POST /api/v1/opportunities/[id]/google-notes` - Link a note
- `GET /api/v1/opportunities/[id]/google-notes` - List notes
- `DELETE /api/v1/opportunities/[id]/google-notes/[noteId]` - Remove link

---

### Linking Google Notes

**User Flow:**
1. User shares Google Doc/Sheet (anyone with link can view)
2. Clicks "Add Google Note" on opportunity
3. Pastes URL, enters title
4. Submits form

**Form Fields:**
```typescript
{
  title: string; // e.g., "Acme Requirements Doc"
  url: string;   // Google Docs/Sheets URL
}
```

**Validation:**
- URL must be from `docs.google.com` or `sheets.google.com`
- Title required (2-200 chars)
- No meeting date (Google notes are reference docs, not meeting notes)

---

### Displaying Google Notes

**List View:**
- Show all notes sorted by `createdAt` desc
- Display title, doc type icon (Docs/Sheets)
- Link to Google URL (opens in new tab)
- No parsing or metadata

---

## 🔄 Background Jobs (Inngest)

### Overview

**Library:** `inngest`
**Config:** `INNGEST_EVENT_KEY` environment variable

**Use Cases:**
- Async transcript parsing (long-running AI calls)
- Scheduled insight consolidation
- Email reminders for close dates
- Batch data processing

---

### Setting Up Inngest Functions

**Example: Gong Transcript Parsing**

```typescript
// /src/inngest/functions/parse-gong-transcript.ts
import { inngest } from '@/inngest/client';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const parseGongTranscript = inngest.createFunction(
  { id: 'parse-gong-transcript' },
  { event: 'gong/transcript.created' },
  async ({ event, step }) => {
    const { gongCallId } = event.data;

    // Step 1: Update status to 'parsing'
    await step.run('update-status-parsing', async () => {
      await prisma.gongCall.update({
        where: { id: gongCallId },
        data: { parsingStatus: 'parsing' }
      });
    });

    // Step 2: Fetch call and parse with AI
    const result = await step.run('parse-transcript', async () => {
      const call = await prisma.gongCall.findUnique({
        where: { id: gongCallId }
      });

      if (!call?.transcriptText) {
        throw new Error('No transcript text');
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

      const prompt = `/* parsing prompt here */`;
      const response = await model.generateContent(prompt);
      const text = response.response.text();

      return JSON.parse(text);
    });

    // Step 3: Update call with results
    await step.run('save-results', async () => {
      await prisma.gongCall.update({
        where: { id: gongCallId },
        data: {
          painPoints: result.painPoints,
          goals: result.goals,
          nextSteps: result.nextSteps,
          parsedPeople: result.parsedPeople,
          riskAssessment: result.riskAssessment,
          parsedAt: new Date(),
          parsingStatus: 'completed',
          parsingError: null
        }
      });
    });
  }
);
```

**Triggering the Job:**

```typescript
// In API route: POST /api/v1/opportunities/[id]/gong-calls
import { inngest } from '@/inngest/client';

await inngest.send({
  name: 'gong/transcript.created',
  data: { gongCallId: createdCall.id }
});
```

---

### Error Handling in Background Jobs

**Use Inngest's retry mechanism:**
```typescript
export const parseGongTranscript = inngest.createFunction(
  {
    id: 'parse-gong-transcript',
    retries: 3, // Retry up to 3 times
  },
  { event: 'gong/transcript.created' },
  async ({ event, step, attempt }) => {
    try {
      // ... job logic
    } catch (error) {
      // Log error
      console.error(`Parse failed (attempt ${attempt}):`, error);

      // Update status to failed
      await prisma.gongCall.update({
        where: { id: event.data.gongCallId },
        data: {
          parsingStatus: 'failed',
          parsingError: error.message
        }
      });

      throw error; // Re-throw to trigger retry
    }
  }
);
```

---

## 🔒 Security Best Practices

### API Key Management
- **Never commit API keys** to version control
- Store in `.env.local` (not `.env`)
- Use environment variables in Vercel
- Rotate keys regularly

### Rate Limiting
- Implement rate limiting for AI endpoints
- Gemini has quota limits - track usage
- Add exponential backoff for retries

### Data Privacy
- **Never send sensitive customer data** to AI without consent
- Anonymize data where possible
- Allow users to opt-out of AI features
- Log all AI API calls for audit

### Error Messages
- Don't expose API keys or internal errors to users
- Use generic error messages: "Failed to generate research"
- Log detailed errors server-side only

---

## 📊 Monitoring & Logging

### AI API Monitoring
- Log all Gemini API calls with:
  - Timestamp
  - Model used
  - Prompt length (tokens)
  - Response length (tokens)
  - Latency
  - Success/failure
  - Cost estimate

### Parsing Status Tracking
- Monitor parsing success rate
- Alert if failure rate > 10%
- Track average parsing time
- Identify stuck jobs (parsing > 10 minutes)

### Usage Tracking
- Track which features are used most
- Monitor account research generation frequency
- Track consolidation trigger frequency
- Identify power users vs. non-users

---

## 🧪 Testing AI Features

### Mock AI Responses
Use mock responses for testing:

```typescript
// /src/__mocks__/@google/generative-ai.ts
export class GoogleGenerativeAI {
  getGenerativeModel() {
    return {
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            painPoints: ['Mock pain point 1', 'Mock pain point 2'],
            goals: ['Mock goal 1'],
            nextSteps: ['Mock next step'],
            parsedPeople: []
          })
        }
      })
    };
  }
}
```

### Integration Tests
Test full workflow end-to-end:
1. Create GongCall with transcript
2. Verify parsing status changes
3. Check parsed data is stored
4. Test retry on failure

### Manual Testing Checklist
- [ ] Create Gong call with transcript
- [ ] Verify parsing completes
- [ ] Check parsed data displays correctly
- [ ] Test retry on failed parse
- [ ] Test consolidation with multiple calls
- [ ] Generate account research
- [ ] Verify research displays correctly
- [ ] Test regenerate research
