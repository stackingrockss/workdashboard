"use client";

import { useState, useEffect } from "react";
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
import { OpportunityStage, OpportunityOwner } from "@/types/opportunity";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { getUsers } from "@/lib/api/users";

interface OpportunityFormProps {
  onSubmit: (data: OpportunityCreateInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<OpportunityCreateInput>;
  submitLabel?: string;
}

const stages: { value: OpportunityStage; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

export function OpportunityForm({
  onSubmit,
  onCancel,
  initialData,
  submitLabel = "Create",
}: OpportunityFormProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<OpportunityOwner[]>([]);
  const [formData, setFormData] = useState<OpportunityCreateInput>({
    name: initialData?.name || "",
    account: initialData?.account || "",
    amountArr: initialData?.amountArr || 0,
    probability: initialData?.probability || 50,
    nextStep: initialData?.nextStep || "",
    closeDate: initialData?.closeDate || "",
    stage: initialData?.stage || "prospect",
    ownerId: initialData?.ownerId || "",
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await getUsers();
        setUsers(data);
        if (!formData.ownerId && data.length > 0) {
          setFormData((prev) => ({ ...prev, ownerId: data[0].id }));
        }
      } catch (error) {
        console.error("Failed to load users:", error);
      }
    }
    loadUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
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
          <Label htmlFor="amountArr">Amount (ARR) *</Label>
          <Input
            id="amountArr"
            type="number"
            min="0"
            step="1000"
            value={formData.amountArr}
            onChange={(e) =>
              setFormData({ ...formData, amountArr: parseInt(e.target.value) || 0 })
            }
            required
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="probability">Probability (%) *</Label>
          <Input
            id="probability"
            type="number"
            min="0"
            max="100"
            value={formData.probability}
            onChange={(e) =>
              setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })
            }
            required
            placeholder="50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage">Stage *</Label>
        <Select
          value={formData.stage}
          onValueChange={(value: OpportunityStage) =>
            setFormData({ ...formData, stage: value })
          }
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

      <div className="space-y-2">
        <Label htmlFor="ownerId">Owner *</Label>
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

      <div className="space-y-2">
        <Label htmlFor="closeDate">Close Date</Label>
        <Input
          id="closeDate"
          type="date"
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
          onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
          placeholder="e.g. Q1 2025"
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
