"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";

interface AIPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog for AI content generation prompts
 * Used when user triggers /ai slash command
 */
export function AIPromptDialog({
  open,
  onOpenChange,
  onGenerate,
  isLoading = false,
}: AIPromptDialogProps) {
  const [prompt, setPrompt] = useState("");

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;

    await onGenerate(prompt);
    setPrompt("");
    onOpenChange(false);
  }, [prompt, isLoading, onGenerate, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Write with AI
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to write... (e.g., 'Write an executive summary of the deal progress')"
            className="min-h-[120px] resize-none"
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tip: Be specific about the tone, length, and format you want.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Suggested prompts for AI generation
 */
export const AI_PROMPT_SUGGESTIONS = [
  "Write an executive summary highlighting key deal progress",
  "Create a bullet list of next steps and action items",
  "Draft a compelling value proposition for this opportunity",
  "Summarize the customer's pain points and how we address them",
  "Write a risk assessment for this deal",
  "Create a timeline of key milestones",
];
