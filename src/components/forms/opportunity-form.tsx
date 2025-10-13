"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { OpportunityStage, OpportunityOwner, ForecastCategory, getDefaultProbability, getStageLabel } from "@/types/opportunity";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { getUsers } from "@/lib/api/users";
import { toast } from "sonner";
import { getQuarterFromDate } from "@/lib/utils/quarter";

interface OpportunityFormProps {
  onSubmit: (data: OpportunityCreateInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<OpportunityCreateInput>;
  submitLabel?: string;
}

const stages: { value: OpportunityStage; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "demo", label: "Demo" },
  { value: "validateSolution", label: "Validate Solution" },
  { value: "decisionMakerApproval", label: "Decision Maker Approval" },
  { value: "contracting", label: "Contracting" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

const forecastCategories = [
  { value: "pipeline", label: "Pipeline" },
  { value: "bestCase", label: "Best Case" },
  { value: "forecast", label: "Forecast (Commit)" },
];

export function OpportunityForm({
  onSubmit,
  onCancel,
  initialData,
  submitLabel = "Create",
}: OpportunityFormProps) {
  const [loading, setLoading] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [users, setUsers] = useState<OpportunityOwner[]>([]);
  const [isProbabilityManuallyEdited, setIsProbabilityManuallyEdited] = useState(false);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);
  const isEditMode = !!initialData?.ownerId; // Edit mode if ownerId is provided
  const [formData, setFormData] = useState<OpportunityCreateInput>({
    name: initialData?.name || "",
    account: initialData?.account || "",
    amountArr: initialData?.amountArr || 0,
    probability: initialData?.probability || getDefaultProbability("discovery"),
    nextStep: initialData?.nextStep || "",
    closeDate: initialData?.closeDate || "",
    quarter: initialData?.quarter || "",
    stage: initialData?.stage || "discovery",
    forecastCategory: initialData?.forecastCategory || "pipeline",
    riskNotes: initialData?.riskNotes || "",
    notes: initialData?.notes || "",
    accountResearch: initialData?.accountResearch || "",
    ownerId: initialData?.ownerId || "",
  });

  // Load fiscal year settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/v1/settings");
        const data = await response.json();
        if (response.ok && data.settings) {
          setFiscalYearStartMonth(data.settings.fiscalYearStartMonth || 1);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
    loadSettings();
  }, []);

  // Load users if in edit mode
  useEffect(() => {
    async function loadUsers() {
      // Only load users if in edit mode
      if (!isEditMode) return;

      try {
        const data = await getUsers();
        setUsers(data);
      } catch (error) {
        console.error("Failed to load users:", error);
      }
    }
    loadUsers();
  }, [isEditMode]);

  // Auto-calculate quarter when close date changes
  useEffect(() => {
    if (formData.closeDate) {
      try {
        const date = new Date(formData.closeDate);
        const calculatedQuarter = getQuarterFromDate(date, fiscalYearStartMonth);
        setFormData(prev => ({ ...prev, quarter: calculatedQuarter }));
      } catch (error) {
        console.error("Failed to calculate quarter:", error);
      }
    } else {
      setFormData(prev => ({ ...prev, quarter: "" }));
    }
  }, [formData.closeDate, fiscalYearStartMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = (newStage: OpportunityStage) => {
    const updates: Partial<OpportunityCreateInput> = { stage: newStage };

    // Only auto-update probability if it hasn't been manually edited
    if (!isProbabilityManuallyEdited) {
      updates.probability = getDefaultProbability(newStage);
    }

    setFormData({ ...formData, ...updates });
  };

  const handleProbabilityChange = (newProbability: number) => {
    setIsProbabilityManuallyEdited(true);
    setFormData({ ...formData, probability: newProbability });
  };

  const handleGenerateNotes = async () => {
    if (!formData.account || formData.account.trim() === "") {
      toast.error("Please enter an account name first");
      return;
    }

    setGeneratingNotes(true);
    try {
      const response = await fetch("/api/v1/ai/meeting-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountName: formData.account,
          stage: formData.stage,
          opportunityValue: formData.amountArr > 0 ? formData.amountArr : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate notes");
      }

      setFormData({ ...formData, accountResearch: data.notes });
      toast.success("Account research generated successfully!");
    } catch (error) {
      console.error("Error generating notes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate notes");
    } finally {
      setGeneratingNotes(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g. New Deal - Acme Corp"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="account">Account *</Label>
        <Input
          id="account"
          value={formData.account}
          onChange={(e) => setFormData({ ...formData, account: e.target.value })}
          required
          placeholder="e.g. Acme Corp"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amountArr">Amount (ARR)</Label>
          <Input
            id="amountArr"
            type="number"
            min="0"
            step="1000"
            value={formData.amountArr}
            onChange={(e) =>
              setFormData({ ...formData, amountArr: parseInt(e.target.value) || 0 })
            }
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="probability">Probability (%)</Label>
          <Input
            id="probability"
            type="number"
            min="0"
            max="100"
            value={formData.probability}
            onChange={(e) => handleProbabilityChange(parseInt(e.target.value) || 0)}
            placeholder="Auto-populates based on stage"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage">Stage</Label>
        <Select
          value={formData.stage}
          onValueChange={(value: OpportunityStage) => handleStageChange(value)}
        >
          <SelectTrigger id="stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isEditMode && (
        <div className="space-y-2">
          <Label htmlFor="ownerId">Owner</Label>
          <Select
            value={formData.ownerId}
            onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
          >
            <SelectTrigger id="ownerId">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="closeDate">Close Date *</Label>
        <Input
          id="closeDate"
          type="date"
          required
          value={formData.closeDate ? formData.closeDate.split("T")[0] : ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              closeDate: e.target.value ? new Date(e.target.value).toISOString() : "",
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quarter">Quarter</Label>
        <Input
          id="quarter"
          value={formData.quarter || ""}
          readOnly
          disabled
          className="bg-muted cursor-not-allowed"
          placeholder="Select a close date to auto-calculate"
        />
        <p className="text-xs text-muted-foreground">
          Auto-calculated based on close date and fiscal year settings
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nextStep">Next Step</Label>
        <Input
          id="nextStep"
          value={formData.nextStep || ""}
          onChange={(e) => setFormData({ ...formData, nextStep: e.target.value })}
          placeholder="e.g. Schedule demo call"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="forecastCategory">Forecast Category</Label>
        <Select
          value={formData.forecastCategory || ""}
          onValueChange={(value) =>
            setFormData({ ...formData, forecastCategory: (value as ForecastCategory) || null })
          }
        >
          <SelectTrigger id="forecastCategory">
            <SelectValue placeholder="Select forecast category" />
          </SelectTrigger>
          <SelectContent>
            {forecastCategories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isEditMode && (
        <div className="space-y-2">
          <Label htmlFor="riskNotes">Risk Notes</Label>
          <Textarea
            id="riskNotes"
            value={formData.riskNotes || ""}
            onChange={(e) => setFormData({ ...formData, riskNotes: e.target.value })}
            placeholder="Any concerns, blockers, or risk mitigation strategies..."
            rows={3}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="accountResearch">Account Research</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateNotes}
            disabled={generatingNotes || !formData.account}
          >
            {generatingNotes ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Researching {formData.account}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Account Research
              </>
            )}
          </Button>
        </div>
        <Textarea
          id="accountResearch"
          value={formData.accountResearch || ""}
          onChange={(e) => setFormData({ ...formData, accountResearch: e.target.value })}
          placeholder="AI-powered account research and pre-meeting intelligence..."
          rows={12}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Your personal notes about this opportunity..."
          rows={6}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
