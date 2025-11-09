"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpportunityStage, OpportunityOwner, ForecastCategory, getDefaultConfidenceLevel } from "@/types/opportunity";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { getUsers } from "@/lib/api/users";
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
  const [users, setUsers] = useState<OpportunityOwner[]>([]);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);
  const isEditMode = !!initialData?.ownerId; // Edit mode if ownerId is provided
  const [formData, setFormData] = useState<OpportunityCreateInput>({
    name: initialData?.name || "",
    account: initialData?.account || "",
    accountWebsite: initialData?.accountWebsite || "",
    amountArr: initialData?.amountArr || 0,
    confidenceLevel: initialData?.confidenceLevel || getDefaultConfidenceLevel("discovery"),
    nextStep: initialData?.nextStep || "",
    closeDate: initialData?.closeDate || "",
    quarter: initialData?.quarter || "",
    stage: initialData?.stage || "discovery",
    forecastCategory: initialData?.forecastCategory || "pipeline",
    riskNotes: initialData?.riskNotes || "",
    ownerId: initialData?.ownerId || "",
    legalReviewStatus: initialData?.legalReviewStatus || "not_started",
    securityReviewStatus: initialData?.securityReviewStatus || "not_started",
    businessCaseStatus: initialData?.businessCaseStatus || "not_started",
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
    setFormData({
      ...formData,
      stage: newStage,
      confidenceLevel: getDefaultConfidenceLevel(newStage)
    });
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

      <div className="space-y-2">
        <Label htmlFor="accountWebsite">Company Website</Label>
        <Input
          id="accountWebsite"
          type="url"
          value={formData.accountWebsite}
          onChange={(e) => setFormData({ ...formData, accountWebsite: e.target.value })}
          placeholder="e.g. acme.com or https://acme.com"
        />
        <p className="text-xs text-muted-foreground">
          Optional - Valuable for AI account research
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amountArr">Amount (ARR)</Label>
        <CurrencyInput
          id="amountArr"
          value={formData.amountArr}
          onChange={(value) => setFormData({ ...formData, amountArr: value })}
          placeholder="0"
        />
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
        <DatePicker
          id="closeDate"
          value={formData.closeDate}
          onChange={(value) => setFormData({ ...formData, closeDate: value })}
          placeholder="MM/DD/YYYY"
          required
        />
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
