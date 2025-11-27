'use client';

/**
 * Parse Granola Transcript Dialog
 *
 * Simplified flow compared to Gong:
 * 1. Paste transcript → Parse button → API call to retry-parsing
 * 2. Close dialog immediately (parsing happens in background)
 * 3. User sees results in GranolaNotesSection via auto-refresh
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ParseGranolaTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  granolaId: string; // Required: The Granola note to parse
  onParsingStarted?: () => void; // Callback after parsing is triggered
}

// ============================================================================
// Component
// ============================================================================

export function ParseGranolaTranscriptDialog({
  open,
  onOpenChange,
  granolaId,
  onParsingStarted,
}: ParseGranolaTranscriptDialogProps) {
  const [transcriptText, setTranscriptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTranscriptText('');
    }
    onOpenChange(newOpen);
  };

  // Trigger parsing via API (background processing)
  const handleParse = async () => {
    if (!transcriptText || transcriptText.trim().length < 100) {
      toast.error('Please paste a valid Granola transcript (minimum 100 characters)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/v1/granola-notes/${granolaId}/retry-parsing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to start parsing');
      }

      // Close dialog immediately
      handleOpenChange(false);

      // Trigger refresh callback
      onParsingStarted?.();

      // Show success toast
      toast.success('Transcript parsing started! Insights will appear shortly.', {
        duration: 4000,
      });
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to start parsing'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parse Granola Transcript</DialogTitle>
          <DialogDescription>
            Paste your Granola meeting transcript to extract key insights
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="transcript" className="text-sm font-medium">
              Granola Transcript
            </label>
            <Textarea
              id="transcript"
              placeholder="Paste your Granola transcript here...

Expected format:
Meeting title
Date and time
Participants

Transcript:
[Speaker]: Dialogue...
"
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Minimum 100 characters required</span>
              <span>{transcriptText.length.toLocaleString()} characters</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleParse}
              disabled={isLoading || transcriptText.length < 100}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Parse...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Parse Transcript
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
