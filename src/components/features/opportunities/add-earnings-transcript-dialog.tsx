"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  earningsTranscriptCreateSchema,
  type EarningsTranscriptCreateInput,
} from "@/lib/validations/earnings-transcript";

interface AddEarningsTranscriptDialogProps {
  accountId: string;
  accountTicker: string | null;
  opportunityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddEarningsTranscriptDialog({
  accountId,
  accountTicker,
  opportunityId,
  open,
  onOpenChange,
  onSuccess,
}: AddEarningsTranscriptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkToOpportunity, setLinkToOpportunity] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EarningsTranscriptCreateInput>({
    resolver: zodResolver(earningsTranscriptCreateSchema),
    defaultValues: {
      quarter: "Q4",
      fiscalYear: new Date().getFullYear(),
      source: "manual",
    },
  });

  const selectedQuarter = watch("quarter");
  const selectedSource = watch("source");

  const onSubmit = async (data: EarningsTranscriptCreateInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/accounts/${accountId}/earnings-transcripts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add earnings transcript");
      }

      const result = await response.json();

      // Link to opportunity if checkbox is checked
      if (linkToOpportunity && result.transcript) {
        await fetch(
          `/api/v1/earnings-transcripts/${result.transcript.id}/link-opportunity`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opportunityId }),
          }
        );
      }

      reset();
      onSuccess();
    } catch (error) {
      console.error("Error adding earnings transcript:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add earnings transcript"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Earnings Call Transcript</DialogTitle>
          <DialogDescription>
            Add a quarterly earnings call transcript for AI analysis
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quarter">Quarter</Label>
              <Select
                value={selectedQuarter}
                onValueChange={(value) => setValue("quarter", value as EarningsTranscriptCreateInput["quarter"])}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1</SelectItem>
                  <SelectItem value="Q2">Q2</SelectItem>
                  <SelectItem value="Q3">Q3</SelectItem>
                  <SelectItem value="Q4">Q4</SelectItem>
                </SelectContent>
              </Select>
              {errors.quarter && (
                <p className="text-sm text-destructive">{errors.quarter.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscalYear">Fiscal Year</Label>
              <Input
                id="fiscalYear"
                type="number"
                placeholder="2024"
                {...register("fiscalYear", { valueAsNumber: true })}
                disabled={isSubmitting}
              />
              {errors.fiscalYear && (
                <p className="text-sm text-destructive">{errors.fiscalYear.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="callDate">Call Date (Optional)</Label>
            <Input
              id="callDate"
              type="date"
              {...register("callDate")}
              disabled={isSubmitting}
            />
            {errors.callDate && (
              <p className="text-sm text-destructive">{errors.callDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={selectedSource}
              onValueChange={(value) => setValue("source", value as EarningsTranscriptCreateInput["source"])}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {accountTicker && (
                  <SelectItem value="financialmodelingprep">
                    Financial Modeling Prep API
                  </SelectItem>
                )}
                <SelectItem value="manual">Manual Upload</SelectItem>
                <SelectItem value="sec-8k">SEC 8-K Filing</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {accountTicker
                ? "API fetch will auto-download transcript"
                : "Add ticker to account to use API"}
            </p>
            {errors.source && (
              <p className="text-sm text-destructive">{errors.source.message}</p>
            )}
          </div>

          {selectedSource === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="transcriptText">Transcript Text</Label>
              <Textarea
                id="transcriptText"
                placeholder="Paste the full earnings call transcript here..."
                className="min-h-[200px] font-mono text-xs"
                {...register("transcriptText")}
                disabled={isSubmitting}
              />
              {errors.transcriptText && (
                <p className="text-sm text-destructive">{errors.transcriptText.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">Source URL (Optional)</Label>
            <Input
              id="sourceUrl"
              type="url"
              placeholder="https://..."
              {...register("sourceUrl")}
              disabled={isSubmitting}
            />
            {errors.sourceUrl && (
              <p className="text-sm text-destructive">{errors.sourceUrl.message}</p>
            )}
          </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="linkToOpportunity"
                checked={linkToOpportunity}
                onCheckedChange={(checked) =>
                  setLinkToOpportunity(checked === true)
                }
              />
              <label
                htmlFor="linkToOpportunity"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Link to this opportunity
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Transcript"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
