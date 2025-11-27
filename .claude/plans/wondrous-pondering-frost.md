# Plan: Add Forecast Category Revenue Summaries to Current Quarter View

## Overview
Add revenue summary cards for forecast categories (Pipeline, Best Case, Commit) at the top of the Current Quarter board view to show users how much revenue is associated with each forecast category.

## User Request
> "at the top of the current quarter board view i want to add a summary for best case, commit and pipeline to show the user how much revenue is associated for each column"

## Confirmed Requirements
- **Location**: Above the existing stats bar (before line 186)
- **Categories**: Just Pipeline, Best Case, and Commit (not all 5)
- **Metrics**: Total ARR and opportunity count per category (no weighted ARR)

## Implementation Approach

**Location**: Add forecast summary section between column controls and existing stats bar (after line 184, before line 186 in CurrentQuarterView.tsx)

**What to Display**:
- 3 cards for Pipeline, Best Case, and Commit
- Each card shows:
  - Category name (Pipeline, Best Case, Commit)
  - Total ARR (sum of `amountArr` for opportunities in that category)
  - Opportunity count

**Visual Treatment**:
- Use color-coded left border matching forecast category colors from built-in-views.ts:
  - Pipeline: border-l-4 border-slate-400
  - Best Case: border-l-4 border-blue-500
  - Commit: border-l-4 border-emerald-500
- Same Card component and responsive grid as existing stats
- Grid layout: `grid-cols-1 md:grid-cols-3 gap-4`

**Files to Modify**:

1. **src/components/opportunities/CurrentQuarterView.tsx** (lines 136-162)
   - Add forecast category stats calculation to existing `useMemo` hook:
   ```typescript
   const stats = useMemo(() => {
     // ... existing calculations ...

     // Group by forecast category
     const forecastStats = {
       pipeline: { arr: 0, count: 0 },
       bestCase: { arr: 0, count: 0 },
       commit: { arr: 0, count: 0 },
     };

     currentQuarterOpps.forEach((opp) => {
       const category = opp.forecastCategory ?? 'pipeline';
       if (category === 'pipeline' || category === 'bestCase' || category === 'commit') {
         forecastStats[category].arr += opp.amountArr;
         forecastStats[category].count += 1;
       }
     });

     return {
       totalArr, weightedArr, count, avgConfidence, atRiskCount, overdueCount,
       forecastStats
     };
   }, [currentQuarterOpps]);
   ```

2. **src/components/opportunities/CurrentQuarterView.tsx** (after line 188, before existing stats)
   - Add new forecast category summary section:
   ```tsx
   {/* Forecast Category Summary */}
   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
     <Card className="p-4 border-l-4 border-slate-400">
       <div className="text-sm text-muted-foreground">Pipeline</div>
       <div className="text-2xl font-bold">
         {formatCurrencyCompact(stats.forecastStats.pipeline.arr)}
       </div>
       <div className="text-xs text-muted-foreground mt-1">
         {stats.forecastStats.pipeline.count} opportunities
       </div>
     </Card>

     <Card className="p-4 border-l-4 border-blue-500">
       <div className="text-sm text-muted-foreground">Best Case</div>
       <div className="text-2xl font-bold">
         {formatCurrencyCompact(stats.forecastStats.bestCase.arr)}
       </div>
       <div className="text-xs text-muted-foreground mt-1">
         {stats.forecastStats.bestCase.count} opportunities
       </div>
     </Card>

     <Card className="p-4 border-l-4 border-emerald-500">
       <div className="text-sm text-muted-foreground">Commit</div>
       <div className="text-2xl font-bold">
         {formatCurrencyCompact(stats.forecastStats.commit.arr)}
       </div>
       <div className="text-xs text-muted-foreground mt-1">
         {stats.forecastStats.commit.count} opportunities
       </div>
     </Card>
   </div>
   ```

**No New Files Needed**: Uses existing utilities and components

**Estimated Implementation Time**: ~1 hour

## Testing Checklist

- [ ] Verify calculations are correct for each category
- [ ] Test with opportunities that have null `forecastCategory` (should default to pipeline)
- [ ] Test responsive layout on mobile, tablet, desktop
- [ ] Verify color coding matches forecast category colors
- [ ] Test with empty state (no opportunities)
- [ ] Test with opportunities in only one category
- [ ] Verify formatCurrencyCompact displays correctly ($1.2M, $50K, etc.)
- [ ] Build passes TypeScript checks
- [ ] No console errors

## Success Criteria

- ✅ Users can see at a glance how much revenue is in Pipeline, Best Case, and Commit
- ✅ Summaries update automatically as opportunities change
- ✅ Visual treatment makes categories easy to distinguish with color-coded borders
- ✅ Responsive layout works on all screen sizes
- ✅ Implementation follows existing patterns (useMemo for calculations, formatCurrencyCompact for display)
- ✅ Positioned above existing stats bar as requested
