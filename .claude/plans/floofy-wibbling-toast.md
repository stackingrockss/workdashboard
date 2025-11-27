# Content Suggestion Feature with Gemini Web Search

**Last Updated:** 2025-11-26

## Overview

Add content suggestion capabilities to the opportunity chat, allowing sales reps to ask for relevant content to share with customers. The system will search the internal content library first, then supplement with web search via Gemini's Google Search grounding.

## User Flow

1. User opens chat on an opportunity and asks: "What content should I send to address their security concerns?"
2. System detects content-related request via keyword matching
3. System searches internal content library for matches based on keywords + customer pain points/goals
4. System sends request to Gemini with:
   - Opportunity context (pain points, goals, stage, industry)
   - Internal content matches (if any)
   - Web search enabled (if internal results < 3)
5. AI streams back natural text mixed with embedded content card markers
6. Client parses stream and renders interactive cards inline with AI explanations
7. User can click "Save to Library" on any web suggestion to add it for the whole org

**Scope:** Both opportunity chat AND account chat

**Chosen Approach:** Embedded markers in streaming response (Approach 1) for natural conversational flow with progressive rendering

---

## Architecture

### Phase 1: Backend AI Integration

#### 1.1 Add Web Search to Gemini

**File:** `src/lib/ai/gemini.ts`

Add new function and types for Google Search grounding:

```typescript
export interface GeminiWebSearchResponse {
  text: string;
  groundingMetadata?: {
    webSearchQueries: string[];
    sources: Array<{ uri: string; title: string }>;
  };
  error?: string;
}

/**
 * Generate content with Google Search grounding enabled
 * @param prompt - User prompt
 * @param systemInstruction - System-level instructions
 * @param modelName - Model to use (default: gemini-2.5-flash)
 * @param maxRetries - Retry attempts (default: 3)
 * @returns Promise with text and grounding metadata
 */
export async function generateWithWebSearch(
  prompt: string,
  systemInstruction: string,
  modelName: string = "gemini-2.5-flash",
  maxRetries: number = 3
): Promise<GeminiWebSearchResponse>
```

**Implementation Details:**
- Use `googleSearchRetrieval` tool with `dynamicRetrievalConfig.mode = "MODE_DYNAMIC"`
- Set `dynamicThreshold: 0.5` to only search when confidence > 50%
- Extract `groundingMetadata` from response for citations
- Include same retry logic as `generateWithSystemInstruction()`
- Return both text and grounding metadata for transparency

---

#### 1.2 Content Search Function

**File:** `src/lib/ai/content-search.ts` (new)

Create internal content library search with relevance scoring:

```typescript
interface ContentSearchParams {
  organizationId: string;
  query: string;
  painPoints?: string[];
  goals?: string[];
  industry?: string;
  limit?: number;
}

interface ScoredContent extends Content {
  relevanceScore: number;
  matchReasons: string[];
}

/**
 * Search organization's content library with relevance scoring
 * Scores based on keyword matches, pain point alignment, goal alignment
 */
export async function searchInternalContent(
  params: ContentSearchParams
): Promise<ScoredContent[]>
```

**Scoring Logic:**
- Title keyword match: +10 points
- Description keyword match: +5 points
- Pain point alignment (keyword in pain point): +3 points each
- Goal alignment (keyword in goal): +3 points each
- Content type bonus: case_study +2, whitepaper +1
- Filter results with score > 0
- Sort by score descending
- Return top N (default 10)

---

#### 1.3 Content Suggestion Orchestrator

**File:** `src/lib/ai/content-suggestion.ts` (new)

Main function that ties everything together:

```typescript
export interface ContentSuggestion {
  source: "internal" | "web";
  id?: string; // Only for internal content
  title: string;
  url: string;
  contentType: ContentType;
  description?: string;
  relevanceReason: string;
}

export interface ContentSuggestionResult {
  suggestions: ContentSuggestion[];
  summary: string;
  webSearchUsed: boolean;
  error?: string;
}

/**
 * Generate content suggestions for an opportunity
 */
export async function generateContentSuggestionsForOpportunity(
  opportunityId: string,
  organizationId: string,
  userQuery: string
): Promise<ContentSuggestionResult>

/**
 * Generate content suggestions for an account
 */
export async function generateContentSuggestionsForAccount(
  accountId: string,
  organizationId: string,
  userQuery: string
): Promise<ContentSuggestionResult>
```

**Flow (Opportunity):**
1. Fetch opportunity with related data (consolidatedPainPoints, consolidatedGoals, account, stage)
2. Call `searchInternalContent()` with query + pain points + goals + industry
3. Decide if web search needed: `internalResults.length < 3`
4. Build prompt with opportunity context + internal matches
5. Call Gemini (with or without web search based on decision)
6. Parse response and extract `[CONTENT_CARD]...[/CONTENT_CARD]` blocks
7. Return structured result

**Flow (Account):**
1. Fetch account with related data (industry, opportunities, earnings transcripts, SEC filings)
2. Extract context: industry, key themes from transcripts/filings
3. Call `searchInternalContent()` with query + industry + themes
4. Same decision logic for web search
5. Build prompt with account context + internal matches
6. Call Gemini and parse response
7. Return structured result

---

### Phase 2: API Integration

#### 2.1 Modify Chat Routes

**Files:**
- `src/app/api/v1/opportunities/[id]/chat/route.ts`
- `src/app/api/v1/accounts/[id]/chat/route.ts`

Add content suggestion detection and branching to BOTH routes:

```typescript
/**
 * Detect if user message is requesting content suggestions
 */
function isContentSuggestionRequest(message: string): boolean {
  const triggers = [
    "suggest content", "recommend content", "what content",
    "share with them", "send them", "collateral",
    "case study", "whitepaper", "blog post", "video",
    "content to share", "materials to send"
  ];
  const lowerMessage = message.toLowerCase();
  return triggers.some(trigger => lowerMessage.includes(trigger));
}
```

**Modified Flow (Opportunity):**
```typescript
// After validating request
const { message, history } = validatedData;

// Detect content suggestion request
if (isContentSuggestionRequest(message)) {
  // Branch to content suggestion flow
  const result = await generateContentSuggestionsForOpportunity(
    opportunityId,
    user.organizationId,
    message
  );

  // Format as streaming response with embedded cards
  // (detailed implementation below)
} else {
  // Regular chat flow (existing code)
}
```

**Modified Flow (Account):**
```typescript
// After validating request
const { message, history } = validatedData;

// Detect content suggestion request
if (isContentSuggestionRequest(message)) {
  // Branch to content suggestion flow
  const result = await generateContentSuggestionsForAccount(
    accountId,
    user.organizationId,
    message
  );

  // Format as streaming response with embedded cards
  // (detailed implementation below)
} else {
  // Regular chat flow (existing code)
}
```

**Content Suggestion Streaming:**

When content suggestion is detected, format the AI response with embedded cards and stream it:

```typescript
// Generate suggestions
const result = await generateContentSuggestions(opportunityId, user.organizationId, message);

if (!result.error && result.suggestions.length > 0) {
  // Format response with embedded cards
  const formattedResponse = formatContentSuggestionsForStreaming(result);

  // Create streaming response
  const stream = new ReadableStream({
    start(controller) {
      // Stream formatted response chunk by chunk
      const chunks = formattedResponse.match(/.{1,50}/g) || [formattedResponse];
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    }
  });

  // Save to database
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { opportunityId, userId: user.id, role: "user", content: message }
    }),
    prisma.chatMessage.create({
      data: { opportunityId, userId: user.id, role: "assistant", content: formattedResponse }
    })
  ]);

  return new Response(stream, { headers: { "Content-Type": "text/plain" } });
}
```

---

### Phase 3: Frontend UI

#### 3.1 Content Card Parser

**File:** `src/lib/utils/parse-content-cards.ts` (new)

Parse streamed response into text + card segments:

```typescript
export interface ParsedSegment {
  type: "text" | "card";
  content: string | ContentSuggestion;
}

/**
 * Parse content with embedded [CONTENT_CARD] markers
 * Returns array of segments (text or card)
 * Handles incomplete blocks during streaming gracefully
 */
export function parseContentCards(content: string): ParsedSegment[]
```

**Implementation:**
- Use regex to find `[CONTENT_CARD]...[/CONTENT_CARD]` blocks
- Extract JSON from each block and parse
- Return alternating text/card segments
- Handle incomplete blocks: if opening tag found without closing, treat as text (streaming in progress)

---

#### 3.2 Content Suggestion Card Component

**File:** `src/components/chat/content-suggestion-card.tsx` (new)

Compact card for displaying suggestions in chat:

```typescript
interface ContentSuggestionCardProps {
  suggestion: ContentSuggestion;
  isSaving: boolean;
  isSaved: boolean;
  onSave: () => void;
}

export function ContentSuggestionCard({
  suggestion,
  isSaving,
  isSaved,
  onSave
}: ContentSuggestionCardProps)
```

**Features:**
- Content type icon (from lucide-react: FileText, BookOpen, Video, etc.)
- Content type badge (color-coded)
- Source badge: "In Library" (blue) or "Web Result" (amber)
- Title (font-semibold, max 2 lines with ellipsis)
- Description (text-sm muted, max 2 lines with ellipsis)
- Relevance reason (text-xs, italic, muted-foreground)
- Action buttons row:
  - Copy Link button (always visible)
  - Open External button (always visible)
  - Save to Library button (web only, shows loading/saved states)

**States:**
1. **Internal content**: Blue "In Library" badge, no save button
2. **Web content - default**: Amber "Web Result" badge, "Save to Library" button
3. **Web content - saving**: Button shows spinner + "Saving..."
4. **Web content - saved**: Green "Saved to Library" badge, button shows checkmark + "Saved" (disabled)

---

#### 3.3 Chat Message Content Renderer

**File:** `src/components/chat/chat-message-content.tsx` (new)

Replace plain text rendering with content-aware component:

```typescript
interface ChatMessageContentProps {
  content: string;
  onSaveContent: (suggestion: ContentSuggestion) => Promise<void>;
  savedUrls: Set<string>;
  savingUrls: Set<string>;
}

export function ChatMessageContent({
  content,
  onSaveContent,
  savedUrls,
  savingUrls
}: ChatMessageContentProps)
```

**Implementation:**
1. Parse content using `parseContentCards()`
2. Map over segments:
   - Text segments: render with `whitespace-pre-wrap`
   - Card segments: render with `<ContentSuggestionCard>`
3. Pass through saved/saving state for each card
4. Handle save button clicks via `onSaveContent` callback

---

#### 3.4 Modify ChatModal

**File:** `src/components/chat/chat-modal.tsx`

Add state and handlers for content saving:

```typescript
// Add state for tracking saved content
const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
const [savingUrls, setSavingUrls] = useState<Set<string>>(new Set());

// Add save handler
const handleSaveContent = async (suggestion: ContentSuggestion) => {
  setSavingUrls(prev => new Set(prev).add(suggestion.url));

  try {
    const response = await fetch('/api/v1/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: suggestion.title,
        url: suggestion.url,
        description: suggestion.description || null,
        contentType: suggestion.contentType,
      }),
    });

    if (response.status === 409) {
      // Already exists - mark as saved
      setSavedUrls(prev => new Set(prev).add(suggestion.url));
      toast.info("This content is already in your library");
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to save content');
    }

    setSavedUrls(prev => new Set(prev).add(suggestion.url));
    toast.success("Content saved to library");
  } catch (error) {
    console.error('Save content error:', error);
    toast.error("Failed to save content");
  } finally {
    setSavingUrls(prev => {
      const next = new Set(prev);
      next.delete(suggestion.url);
      return next;
    });
  }
};
```

**Replace message rendering:**
```tsx
// Before (line 215):
<p className="text-sm whitespace-pre-wrap">{message.content}</p>

// After:
<ChatMessageContent
  content={message.content}
  onSaveContent={handleSaveContent}
  savedUrls={savedUrls}
  savingUrls={savingUrls}
/>
```

---

### Phase 4: System Instruction & Prompt

#### 4.1 Content Suggestion System Instruction

**File:** `src/lib/ai/content-suggestion.ts`

```typescript
export const CONTENT_SUGGESTION_SYSTEM_INSTRUCTION = `You are a sales enablement specialist helping sales representatives find and suggest relevant content for their opportunities.

**YOUR ROLE:**
- Analyze the customer's pain points, goals, and deal context
- Recommend content that directly addresses their specific challenges
- Prioritize internal library content when available
- Supplement with web-sourced content when internal library is insufficient
- Explain WHY each piece of content is relevant to this opportunity

**RESPONSE FORMAT:**
You must respond with a natural conversational style that embeds structured content cards.

1. Start with an introductory paragraph explaining the recommendations
2. Insert content cards using this exact format:
   [CONTENT_CARD]{"source":"internal","id":"clx123","title":"...","url":"...","contentType":"...","description":"...","relevanceReason":"..."}[/CONTENT_CARD]
3. Add explanatory sentences between cards explaining their relevance
4. End with usage advice (when to send, how to position, etc.)

**CONTENT CARD RULES:**
- Use double quotes for all JSON keys and string values
- Escape any quotes inside string values
- Valid contentType values: "case_study", "blog_post", "whitepaper", "video", "webinar", "other"
- Valid source values: "internal" or "web"
- Include "id" field only for internal content
- Keep description under 150 characters
- relevanceReason should tie directly to customer pain points or goals

**CONTENT SELECTION RULES:**
1. Always prioritize internal library content first if relevant
2. Only suggest reputable web sources (vendor sites, industry publications, analyst reports)
3. Limit to 5-7 suggestions maximum
4. Include a mix of content types when available (case studies + whitepapers + videos)
5. Match content to deal stage (early stage = educational, late stage = validation/ROI)
6. Be honest if no relevant content exists - suggest what type would help instead

**WRITING STYLE:**
- Be conversational and helpful, not robotic
- Explain the "why" behind each suggestion
- Connect content to specific customer concerns mentioned in context
- Give actionable advice on how to use the content
- Keep total response under 500 words`;
```

#### 4.2 Prompt Builder

```typescript
export function buildContentSuggestionPrompt(params: {
  userQuery: string;
  internalContent: ScoredContent[];
  opportunityContext: {
    opportunityName: string;
    accountName: string;
    industry?: string;
    stage: string;
    painPoints: string[];
    goals: string[];
    confidenceLevel: number;
  };
}): string {
  const { userQuery, internalContent, opportunityContext } = params;

  return `## Content Suggestion Request

**User Query:** ${userQuery}

## Opportunity Context

**Opportunity:** ${opportunityContext.opportunityName}
**Account:** ${opportunityContext.accountName}
**Industry:** ${opportunityContext.industry || "Unknown"}
**Deal Stage:** ${opportunityContext.stage}
**Confidence Level:** ${opportunityContext.confidenceLevel}/5

**Customer Pain Points:**
${opportunityContext.painPoints.length > 0
  ? opportunityContext.painPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")
  : "No pain points documented yet."}

**Customer Goals:**
${opportunityContext.goals.length > 0
  ? opportunityContext.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")
  : "No goals documented yet."}

## Internal Content Library Results

${internalContent.length > 0
  ? internalContent.map((c, i) => `
**${i + 1}. ${c.title}**
- Type: ${c.contentType}
- URL: ${c.url}
- Description: ${c.description || "No description"}
- Relevance Score: ${c.relevanceScore} (matched on: ${c.matchReasons.join(", ")})
`).join("\n")
  : "No matching internal content found. Please search the web for relevant materials."}

---

Based on the opportunity context${internalContent.length > 0 ? " and internal content library" : ""}, recommend the most relevant content for this opportunity. Remember to use the [CONTENT_CARD] format and explain why each piece is relevant.`;
}
```

---

## Files to Create

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/lib/ai/content-search.ts` | Internal content library search with scoring | ~150 |
| `src/lib/ai/content-suggestion.ts` | Orchestration, prompt building, parsing (opportunity + account) | ~350 |
| `src/lib/utils/parse-content-cards.ts` | Parse embedded card markers from stream | ~60 |
| `src/components/chat/content-suggestion-card.tsx` | Card UI component for suggestions | ~180 |
| `src/components/chat/chat-message-content.tsx` | Content-aware message renderer | ~80 |
| `src/types/content-suggestion.ts` | TypeScript types for content suggestions | ~40 |

**Total new code:** ~860 lines

---

## Files to Modify

| File | Changes | Lines Changed |
|------|---------|---------------|
| `src/lib/ai/gemini.ts` | Add `generateWithWebSearch()` function | ~60 new |
| `src/app/api/v1/opportunities/[id]/chat/route.ts` | Add content detection, branching logic | ~80 new |
| `src/app/api/v1/accounts/[id]/chat/route.ts` | Add content detection, branching logic | ~80 new |
| `src/components/chat/chat-modal.tsx` | Add save handlers, use new renderer | ~50 modified |

**Total modified code:** ~270 lines

---

## Implementation Order

### Step 1: Backend Foundation (Day 1)
1. Add `generateWithWebSearch()` to `gemini.ts`
2. Create `content-search.ts` with scoring logic
3. Test internal search with existing content library

### Step 2: AI Orchestration (Day 1-2)
4. Create `content-suggestion.ts` with orchestrators (opportunity + account)
5. Build prompt templates and system instruction for both entity types
6. Test with sample opportunities and accounts (manual API calls)

### Step 3: API Integration (Day 2)
7. Modify BOTH chat routes (opportunity + account) to detect content requests
8. Add content suggestion branch in both chat flows
9. Test end-to-end streaming with embedded cards for both entity types

### Step 4: Frontend Parsing (Day 2-3)
10. Create `parse-content-cards.ts` utility
11. Test parsing with sample responses (unit tests)

### Step 5: UI Components (Day 3)
12. Build `ContentSuggestionCard` component
13. Build `ChatMessageContent` renderer
14. Test rendering in isolation (Storybook optional)

### Step 6: Integration (Day 3)
15. Modify `ChatModal` to use new renderer
16. Add save handlers and state management
17. Test full flow: ask → stream → render → save

### Step 7: Testing & Polish (Day 4)
18. Test with various queries and opportunities
19. Handle edge cases (no results, errors, duplicates)
20. Optimize prompt based on real results
21. Add error boundaries and fallbacks

---

## Cost Optimization Strategies

1. **Conditional Web Search**: Only enable when `internalResults.length < 3`
2. **Dynamic Threshold**: Use `dynamicThreshold: 0.5` so Gemini only searches when needed
3. **Model Selection**: Use `gemini-2.5-flash` (fast + affordable) not Pro
4. **Cache Internal Search**: Content library rarely changes, cache for 5 minutes
5. **Save to Library**: Web suggestions saved by users reduce future web searches
6. **Rate Limiting**: Existing 10 req/min per user prevents abuse

**Estimated costs** (assuming $0.15 per 1M tokens for Flash):
- Internal-only request: ~5K tokens = $0.00075
- With web search: ~8K tokens = $0.0012
- Monthly (1000 requests, 30% web): ~$0.95

---

## Error Handling

### Graceful Degradation

| Failure Scenario | Fallback Behavior |
|------------------|-------------------|
| Internal search fails | Log error, proceed with web search only |
| Web search fails | Return internal results only with message |
| No results at all | AI suggests what type of content would help |
| Gemini API error | Return generic error message, don't block chat |
| Save to library fails (network) | Show error toast, keep "Save" button enabled |
| Save to library fails (409 duplicate) | Mark as "Already in Library", show info toast |
| Incomplete streaming | Parser ignores partial `[CONTENT_CARD]` blocks |
| Malformed JSON in card | Log error, display as plain text |

### User-Facing Messages

- **No internal results**: "I couldn't find matching content in your library. Here's what I found on the web..."
- **No results at all**: "I couldn't find specific content for this request. Consider creating a case study about [relevant topic] or a whitepaper on [pain point]."
- **Save success**: Toast - "Content saved to library"
- **Save duplicate**: Toast - "This content is already in your library"
- **Save error**: Toast - "Failed to save content. Please try again."

---

## Testing Strategy

### Unit Tests
- `parseContentCards()` with various inputs (complete, partial, malformed)
- `searchInternalContent()` scoring logic
- JSON parsing for card blocks

### Integration Tests
- Full content suggestion flow (mock Gemini)
- Chat route content detection
- Save to library with duplicate detection

### Manual Testing Checklist

**Opportunity Chat:**
- [ ] Ask for content in empty library → web search only
- [ ] Ask for content with matches → internal + web
- [ ] Ask for content with 3+ matches → internal only (no web)
- [ ] Content suggestions match opportunity pain points/goals
- [ ] Non-content questions still work normally

**Account Chat:**
- [ ] Ask for content suggestions → receives relevant suggestions
- [ ] Content suggestions match account industry/context
- [ ] Non-content questions still work normally

**UI/Save Flow (both):**
- [ ] Click "Save to Library" → content appears in library
- [ ] Try to save duplicate → info message, no error
- [ ] View saved content on /content page → appears correctly
- [ ] Copy link button → URL copied to clipboard
- [ ] Open external button → opens in new tab
- [ ] Streaming renders cards progressively

---

## Future Enhancements (Post-MVP)

1. **Content analytics**: Track which content is suggested/saved most
3. **Smart recommendations**: Learn from which content closes deals
4. **Email integration**: "Send this content" button that drafts email
5. **Content tagging**: Tag content by pain point/industry/persona for better matching
6. **AI-generated descriptions**: Auto-generate descriptions for web content when saving
7. **Citation management**: Show which sources Gemini used for web suggestions
8. **Content relevance feedback**: "Was this helpful?" to improve future suggestions

---

## Critical Files Reference

**Must Read Before Implementation:**
- `src/app/api/v1/opportunities/[id]/chat/route.ts` - Opportunity chat API pattern
- `src/app/api/v1/accounts/[id]/chat/route.ts` - Account chat API pattern
- `src/components/chat/chat-modal.tsx` - Chat UI and streaming (shared by both)
- `src/lib/ai/gemini.ts` - Gemini wrapper patterns
- `src/lib/ai/chat-context.ts` - Context building patterns (opportunity + account)
- `src/app/api/v1/content/route.ts` - Content API and duplicate handling
- `src/lib/validations/content.ts` - Content schemas
- `src/types/content.ts` - Content types

**Related Patterns:**
- `src/lib/ai/consolidate-call-insights.ts` - JSON parsing from AI responses
- `src/components/features/opportunities/consolidated-insights-card.tsx` - Multi-section insight UI
- `src/components/features/content/content-card.tsx` - Content display patterns