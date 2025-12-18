# Folder Reorganization Migration Plan

**Created:** 2025-12-17
**Status:** Phase 1 Complete ✅

---

## Overview

This document outlines the complete migration plan for reorganizing the codebase folder structure to improve consistency, remove dead code, and follow project naming conventions.

---

## ✅ Phase 1: Completed Changes

### 1.1 Deleted Orphaned Files
- ✅ `neon_backup.dump` - Empty file
- ✅ `nul` - Windows artifact
- ✅ `opportunity-tracker/` - Old project copy with node_modules
- ✅ `src/components/features/opportunities/opportunity-detail-client.tsx.bak` - Backup file

### 1.2 Deleted Empty Directories
- ✅ `src/data/` - Empty, unused
- ✅ `src/lib/data/` - Moved single file to lib root
- ✅ `src/lib/hooks/` - Consolidated to src/hooks
- ✅ `src/components/opportunity/` - Merged to opportunities/

### 1.3 Renamed Components to PascalCase

**Forms Directory (`src/components/forms/`):**
- ✅ `account-form.tsx` → `AccountForm.tsx`
- ✅ `contact-form.tsx` → `ContactForm.tsx`
- ✅ `opportunity-form.tsx` → `OpportunityForm.tsx`
- ✅ `column-form.tsx` → `ColumnForm.tsx`

**Chat Directory (`src/components/chat/`):**
- ✅ `chat-fab.tsx` → `ChatFab.tsx`
- ✅ `chat-widget.tsx` → `ChatWidget.tsx`
- ✅ `chat-modal.tsx` → `ChatModal.tsx`
- ✅ `chat-message-content.tsx` → `ChatMessageContent.tsx`
- ✅ `content-suggestion-card.tsx` → `ContentSuggestionCard.tsx`

**Tasks Directory (`src/components/tasks/`):**
- ✅ `task-card.tsx` → `TaskCard.tsx`
- ✅ `task-filter-control.tsx` → `TaskFilterControl.tsx`
- ✅ `upcoming-tasks-widget.tsx` → `UpcomingTasksWidget.tsx`
- ✅ `inline-due-date-editor.tsx` → `InlineDueDateEditor.tsx`

**Opportunities Directory (`src/components/opportunities/`):**
- ✅ `opportunities-list-paginated.tsx` → `OpportunitiesListPaginated.tsx`

**Calendar Directory (`src/components/calendar/`):**
- ✅ `schedule-followup-dialog.tsx` → `ScheduleFollowupDialog.tsx`
- ✅ `gong-call-item.tsx` → `GongCallItem.tsx`
- ✅ `granola-note-item.tsx` → `GranolaNoteItem.tsx`
- ✅ `orphaned-notes-section.tsx` → `OrphanedNotesSection.tsx`
- ✅ `add-manual-meeting-dialog.tsx` → `AddManualMeetingDialog.tsx`
- ✅ `meeting-event-card.tsx` → `MeetingEventCard.tsx`
- ✅ `calendar-event-card.tsx` → `CalendarEventCard.tsx`
- ✅ `related-events-section.tsx` → `RelatedEventsSection.tsx`
- ✅ `upcoming-meetings-widget.tsx` → `UpcomingMeetingsWidget.tsx`

### 1.4 Consolidated Directories
- ✅ `src/lib/hooks/use-opportunities.ts` → `src/hooks/useOpportunities.ts`
- ✅ `src/components/opportunity/DecisionMakerSection.tsx` → `src/components/opportunities/DecisionMakerSection.tsx`
- ✅ `src/lib/data/verifiable-content.ts` → `src/lib/verifiable-content.ts`

### 1.5 Updated All Imports
All import statements have been updated to reflect the new file locations and naming conventions.

### 1.6 Verification
- ✅ `npm run lint` - Passed (warnings only)
- ✅ `npx tsc --noEmit` - Passed
- ✅ `npm run build` - Passed

---

## 🔮 Phase 2: Optional Future Improvements

The `src/components/features/` directory still contains ~60 kebab-case files. These could be renamed for consistency, but this is a larger undertaking as they have many internal cross-references.

**Files that could be renamed (optional):**
- `src/components/features/opportunities/*.tsx` (~30 files)
- `src/components/features/prospects/*.tsx` (~8 files)
- `src/components/features/settings/*.tsx` (~6 files)
- `src/components/features/users/*.tsx` (~4 files)
- `src/components/features/content/*.tsx` (~3 files)

**Shadcn/UI components in `src/components/ui/` use kebab-case by convention** - these should NOT be renamed as that's the standard for shadcn/ui.

---

## Summary of Changes

| Category | Before | After |
|----------|--------|-------|
| Orphaned files | 4 files/folders | 0 |
| Empty directories | 4 | 0 |
| Duplicate directories | 3 pairs | 0 |
| PascalCase components | ~70% | ~85% |
| Split hook locations | 2 | 1 |

---

## Rollback Plan

If issues occur:
- All changes are tracked in git
- Run `git checkout .` to revert all changes
- Individual files can be restored with `git checkout -- <filepath>`
