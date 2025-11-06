"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpportunityStage, getDefaultConfidenceLevel, getStageLabel } from "@/types/opportunity";

interface ConvertToOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

export function ConvertToOpportunityDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
}: ConvertToOpportunityDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    amountArr: string;
    stage: OpportunityStage;
    confidenceLevel: string;
    closeDate: string;
    quarter: string;
    forecastCategory: "pipeline" | "bestCase" | "forecast";
    nextStep: string;
  }>({
    name: `${accountName} - Opportunity`,
    amountArr: "",
    stage: "discovery",
    confidenceLevel: getDefaultConfidenceLevel("discovery").toString(),
    closeDate: "",
    quarter: "",
    forecastCategory: "pipeline",
    nextStep: "",
  });

  const handleStageChange = (stage: OpportunityStage) => {
    setFormData({
      ...formData,
      stage,
      confidenceLevel: getDefaultConfidenceLevel(stage).toString(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/accounts/${accountId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          amountArr: parseInt(formData.amountArr),
          stage: formData.stage,
          confidenceLevel: parseInt(formData.confidenceLevel),
          closeDate: formData.closeDate || null,
          quarter: formData.quarter || null,
          forecastCategory: formData.forecastCategory || null,
          nextStep: formData.nextStep || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to convert to opportunity");
      }

      const { opportunity } = await response.json();

      toast.success("Prospect converted to opportunity!");
      onOpenChange(false);
      router.push(`/opportunities/${opportunity.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert to opportunity");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert to Opportunity</DialogTitle>
          <DialogDescription>
            Create an opportunity from this prospect. All contacts and notes will be copied to the new opportunity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Opportunity Name *</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter opportunity name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountArr">Amount (ARR) *</Label>
              <Input
                id="amountArr"
                type="number"
                required
                min="0"
                value={formData.amountArr}
                onChange={(e) => setFormData({ ...formData, amountArr: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidenceLevel">Confidence Level (1-5)</Label>
              <Input
                id="confidenceLevel"
                type="number"
                min="1"
                max="5"
                value={formData.confidenceLevel}
                onChange={(e) => setFormData({ ...formData, confidenceLevel: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Stage *</Label>
            <Select
              value={formData.stage}
              onValueChange={(value) => handleStageChange(value as OpportunityStage)}
            >
              <SelectTrigger id="stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discovery">{getStageLabel("discovery")}</SelectItem>
                <SelectItem value="demo">{getStageLabel("demo")}</SelectItem>
                <SelectItem value="validateSolution">{getStageLabel("validateSolution")}</SelectItem>
                <SelectItem value="decisionMakerApproval">{getStageLabel("decisionMakerApproval")}</SelectItem>
                <SelectItem value="contracting">{getStageLabel("contracting")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closeDate">Close Date</Label>
              <Input
                id="closeDate"
                type="date"
                value={formData.closeDate}
                onChange={(e) => setFormData({ ...formData, closeDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quarter">Quarter</Label>
              <Input
                id="quarter"
                value={formData.quarter}
                onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                placeholder="e.g., Q1 2025"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forecastCategory">Forecast Category</Label>
            <Select
              value={formData.forecastCategory}
              onValueChange={(value: "pipeline" | "bestCase" | "forecast") => setFormData({ ...formData, forecastCategory: value })}
            >
              <SelectTrigger id="forecastCategory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pipeline">Pipeline</SelectItem>
                <SelectItem value="bestCase">Best Case</SelectItem>
                <SelectItem value="forecast">Forecast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextStep">Next Step</Label>
            <Input
              id="nextStep"
              value={formData.nextStep}
              onChange={(e) => setFormData({ ...formData, nextStep: e.target.value })}
              placeholder="What's the next action?"
            />
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
              {isSubmitting ? "Converting..." : "Convert to Opportunity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
