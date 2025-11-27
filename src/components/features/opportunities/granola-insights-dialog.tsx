'use client';

/**
 * Granola Insights Dialog
 *
 * Displays parsed insights from a Granola note using shared UI components:
 * - InsightsCard (pain points, goals, next steps)
 * - PeopleTable (extracted people)
 * - RiskAssessmentCard (risk analysis)
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InsightsCard } from '@/components/transcript/InsightsCard';
import { PeopleTable } from '@/components/transcript/PeopleTable';
import { RiskAssessmentCard } from '@/components/transcript/RiskAssessmentCard';
import { Badge } from '@/components/ui/badge';
import { GranolaNote } from '@/types/granola-note';
import { formatDateShort } from '@/lib/format';
import { Calendar, FileText } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GranolaInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: GranolaNote;
  opportunityId?: string; // Optional: For contact import
  onContactsImported?: () => void; // Callback after contacts imported
}

// ============================================================================
// Component
// ============================================================================

export function GranolaInsightsDialog({
  open,
  onOpenChange,
  note,
  opportunityId,
  onContactsImported,
}: GranolaInsightsDialogProps) {
  // Check if parsing is complete
  const hasInsights = note.parsingStatus === 'completed' && (
    note.painPoints || note.goals || note.nextSteps || note.parsedPeople
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {note.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDateShort(note.meetingDate)}
            </span>
            <Badge variant="outline" className="capitalize">
              {note.noteType}
            </Badge>
            {note.parsingStatus && (
              <Badge
                variant={
                  note.parsingStatus === 'completed'
                    ? 'default'
                    : note.parsingStatus === 'failed'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {note.parsingStatus}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Display parsed insights */}
        {hasInsights ? (
          <div className="space-y-4">
            {/* Pain Points */}
            {note.painPoints && note.painPoints.length > 0 && (
              <InsightsCard
                title="Pain Points / Challenges"
                items={note.painPoints}
                variant="pain"
              />
            )}

            {/* Goals */}
            {note.goals && note.goals.length > 0 && (
              <InsightsCard
                title="Goals / Future State"
                items={note.goals}
                variant="goal"
              />
            )}

            {/* Next Steps */}
            {note.nextSteps && note.nextSteps.length > 0 && (
              <InsightsCard
                title="Next Steps"
                items={note.nextSteps}
                variant="next"
              />
            )}

            {/* People */}
            {note.parsedPeople && note.parsedPeople.length > 0 && (
              <PeopleTable people={note.parsedPeople} />
            )}

            {/* Risk Assessment */}
            {note.riskAssessment && (
              <RiskAssessmentCard riskAssessment={note.riskAssessment} />
            )}
          </div>
        ) : note.parsingStatus === 'failed' ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">Parsing Failed</p>
            {note.parsingError && (
              <p className="text-sm text-muted-foreground mt-1">
                {note.parsingError}
              </p>
            )}
          </div>
        ) : note.parsingStatus === 'parsing' ? (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Parsing in progress... Insights will appear shortly.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No insights available. Upload a transcript to extract insights.
            </p>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
