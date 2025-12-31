# Plan: Enhanced Insights as Default Context (No Full Transcripts)

## Overview

Change document generation to use **extracted insights only** by default, with an optional toggle to include full transcripts for power users. This dramatically reduces token usage while maintaining output quality.

## Current State

- Full transcripts (up to 115K chars each) are always included when meetings are selected
- With 5 meetings averaging 45K chars, that's ~225K chars of transcript
- Most of this is filler/noise that the AI has to re-parse

## Target State

- **Default:** Only include structured insights (painPoints, goals, keyQuotes, objections, etc.)
- **Optional:** Toggle to include full transcripts when needed
- Estimated token savings: 90%+ for meeting context

---

## Implementation Steps

### Step 1: Update Context Selection Schema

**File:** `src/lib/validations/brief.ts`

Add new optional field:

```typescript
export const contextSelectionSchema = z.object({
  gongCallIds: z.array(z.string()).optional().default([]),
  granolaNoteIds: z.array(z.string()).optional().default([]),
  googleNoteIds: z.array(z.string()).optional().default([]),
  includeAccountResearch: z.boolean().optional().default(false),
  includeConsolidatedInsights: z.boolean().optional().default(true),
  additionalContext: z.string().max(5000).optional(),
  referenceDocumentIds: z.array(z.string()).optional().default([]),
  referenceContentIds: z.array(z.string()).optional().default([]),
  // NEW: Toggle for full transcripts (defaults to OFF)
  includeMeetingTranscripts: z.boolean().optional().default(false),
});
```

### Step 2: Update Context Aggregator

**File:** `src/lib/ai/context-aggregator.ts`

**2a. Update function signature to accept the new flag:**

```typescript
export async function aggregateContext(
  opportunityId: string,
  selection: ContextSelectionInput
): Promise<AggregatedContext> {
```

The selection already includes all fields from the schema, so no signature change needed.

**2b. Conditionally include transcript in Gong call mapping (~line 184):**

Change from:
```typescript
transcriptSummary: call.transcriptText
  ? truncateText(call.transcriptText, 115000)
  : undefined,
```

To:
```typescript
transcriptSummary: selection.includeMeetingTranscripts && call.transcriptText
  ? truncateText(call.transcriptText, 115000)
  : undefined,
```

**2c. Same change for Granola notes (~line 212):**

```typescript
transcriptSummary: selection.includeMeetingTranscripts && note.transcriptText
  ? truncateText(note.transcriptText, 115000)
  : undefined,
```

### Step 3: Update ContextSelectionInput Type

**File:** `src/lib/validations/framework.ts`

Ensure the type is re-exported or updated if it's defined separately from the schema.

Check if `ContextSelectionInput` is inferred from `contextSelectionSchema` or defined manually. Update accordingly.

### Step 4: Update UI - ContextSelectionStep

**File:** `src/components/features/opportunities/generate/ContextSelectionStep.tsx`

**4a. Add state for the toggle:**

```typescript
const [includeMeetingTranscripts, setIncludeMeetingTranscripts] = useState(false);
```

**4b. Add toggle UI in the Meetings section (or AI Insights section):**

```tsx
<div className="flex items-center justify-between mt-4 pt-4 border-t">
  <div className="space-y-0.5">
    <Label htmlFor="include-transcripts" className="text-sm font-medium">
      Include full transcripts
    </Label>
    <p className="text-xs text-muted-foreground">
      AI insights are included by default. Enable this for raw transcript access.
    </p>
  </div>
  <Switch
    id="include-transcripts"
    checked={includeMeetingTranscripts}
    onCheckedChange={setIncludeMeetingTranscripts}
  />
</div>
```

**4c. Include in context selection output:**

When building the context selection object to pass to the API:

```typescript
const contextSelection = {
  gongCallIds: selectedGongCalls,
  granolaNoteIds: selectedGranolaNotes,
  googleNoteIds: selectedGoogleNotes,
  includeAccountResearch,
  includeConsolidatedInsights,
  additionalContext,
  referenceDocumentIds,
  referenceContentIds,
  includeMeetingTranscripts, // NEW
};
```

**4d. Update token estimation to reflect the change:**

The token estimate should show much lower usage when transcripts are off. Update the estimation logic to:
- When `includeMeetingTranscripts = false`: Only count insight fields
- When `includeMeetingTranscripts = true`: Include full transcript lengths

### Step 5: Update ContextSelectionPanel (if used)

**File:** `src/components/features/opportunities/frameworks/ContextSelectionPanel.tsx`

Add the same toggle if this lighter component is used elsewhere.

### Step 6: Update Token Estimation Utility

**File:** `src/lib/utils/token-estimation.ts` (or wherever token estimation lives)

Update to account for the new toggle:

```typescript
function estimateMeetingTokens(
  meetings: Meeting[],
  includeTranscripts: boolean
): number {
  if (includeTranscripts) {
    // Include full transcript length
    return meetings.reduce((sum, m) => sum + (m.transcriptText?.length || 0) / 4, 0);
  } else {
    // Only count structured insights (~500-1500 chars per meeting)
    return meetings.length * 300; // ~300 tokens per meeting for insights only
  }
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/validations/brief.ts` | Add `includeMeetingTranscripts` field to schema |
| `src/lib/validations/framework.ts` | Ensure type is updated (if separate from schema) |
| `src/lib/ai/context-aggregator.ts` | Conditionally include transcripts based on flag |
| `src/components/features/opportunities/generate/ContextSelectionStep.tsx` | Add toggle UI and state |
| `src/components/features/opportunities/frameworks/ContextSelectionPanel.tsx` | Add toggle if applicable |
| Token estimation utility (location TBD) | Update estimation logic |

---

## Testing Plan

1. **Generate document with default settings (transcripts OFF)**
   - Verify insights are included
   - Verify transcripts are NOT included
   - Check token estimate is low

2. **Generate document with transcripts ON**
   - Verify full transcripts are included
   - Check token estimate is high

3. **Compare output quality**
   - Generate same document type with both settings
   - Verify insights-only produces comparable quality

---

## Token Impact Estimate

| Scenario | Meetings | With Transcripts | Insights Only | Savings |
|----------|----------|------------------|---------------|---------|
| Small deal | 3 calls | ~100K chars | ~4K chars | 96% |
| Medium deal | 6 calls | ~270K chars | ~8K chars | 97% |
| Large deal | 12 calls | ~540K chars | ~15K chars | 97% |

This allows including **many more meetings** within the same token budget, giving the AI better coverage of the deal history.

---

## Future Enhancements (Out of Scope)

- Per-meeting transcript toggle (include transcript for just one key meeting)
- Smart transcript inclusion based on brief type
- Transcript summarization (AI-generated summary instead of raw text)