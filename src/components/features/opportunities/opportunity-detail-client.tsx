"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Opportunity, getStageLabel, OpportunityStage } from "@/types/opportunity";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { updateOpportunity, deleteOpportunity, updateOpportunityField } from "@/lib/api/opportunities";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { GranolaNotesSection } from "./granola-notes-section";
import { GongCallsSection } from "./gong-calls-section";
import { GoogleNotesSection } from "./google-notes-section";
import { OrgChartSection } from "@/components/contacts/OrgChartSection";
import { Separator } from "@/components/ui/separator";
import {
  InlineTextInput,
  InlineTextarea,
  InlineSelect,
  InlineDatePicker,
} from "@/components/ui/inline-editable";

interface OpportunityDetailClientProps {
  opportunity: Opportunity;
}

const stageOptions = [
  { value: "discovery", label: "Discovery" },
  { value: "demo", label: "Demo" },
  { value: "validateSolution", label: "Validate Solution" },
  { value: "decisionMakerApproval", label: "Decision Maker Approval" },
  { value: "contracting", label: "Contracting" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

const forecastCategoryOptions = [
  { value: "pipeline", label: "Pipeline" },
  { value: "bestCase", label: "Best Case" },
  { value: "forecast", label: "Forecast (Commit)" },
];

export function OpportunityDetailClient({ opportunity }: OpportunityDetailClientProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleUpdateOpportunity = async (data: OpportunityUpdateInput) => {
    try {
      await updateOpportunity(opportunity.id, data);
      toast.success("Opportunity updated successfully!");
      setIsEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update opportunity");
    }
  };

  const handleFieldUpdate = async (
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => {
    try {
      await updateOpportunityField(opportunity.id, field, value);
      toast.success("Updated successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
      throw error;
    }
  };

  const handleDeleteOpportunity = async () => {
    setIsDeleting(true);
    try {
      await deleteOpportunity(opportunity.id);
      toast.success("Opportunity deleted successfully!");
      router.push("/opportunities");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete opportunity");
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/opportunities">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Opportunities
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.name}</h1>
          <p className="text-sm text-muted-foreground">
            {opportunity.account?.name || opportunity.accountName || "No Account"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InlineSelect
          label="Stage"
          value={opportunity.stage}
          onSave={async (value) => handleFieldUpdate("stage", value)}
          options={stageOptions}
          displayFormatter={(val) => getStageLabel(val as OpportunityStage)}
        />
        <InlineTextInput
          label="Amount (ARR)"
          value={opportunity.amountArr}
          onSave={async (value) => handleFieldUpdate("amountArr", value)}
          type="number"
          min={0}
          step={1000}
          displayFormatter={(val) => `${formatCurrencyCompact(val as number)} ARR`}
        />
        <InlineTextInput
          label="Probability"
          value={opportunity.probability}
          onSave={async (value) => handleFieldUpdate("probability", value)}
          type="number"
          min={0}
          max={100}
          displayFormatter={(val) => `${val}%`}
        />
        <InlineDatePicker
          label="Close date"
          value={opportunity.closeDate}
          onSave={async (value) => handleFieldUpdate("closeDate", value)}
          displayFormatter={(val) => formatDateShort(val as string)}
        />
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Owner</div>
          <div className="font-medium">{opportunity.owner.name}</div>
        </div>
        <InlineSelect
          label="Forecast Category"
          value={opportunity.forecastCategory || ""}
          onSave={async (value) => handleFieldUpdate("forecastCategory", value || null)}
          options={forecastCategoryOptions}
          placeholder="Select category"
          displayFormatter={(val) =>
            val ? forecastCategoryOptions.find(o => o.value === val)?.label || "" : "—"
          }
        />
        <InlineTextInput
          label="Next step"
          value={opportunity.nextStep || ""}
          onSave={async (value) => handleFieldUpdate("nextStep", value)}
          placeholder="e.g. Schedule demo call"
          className="md:col-span-2 lg:col-span-3"
        />
        <InlineTextarea
          label="Risk Notes"
          value={opportunity.riskNotes || ""}
          onSave={async (value) => handleFieldUpdate("riskNotes", value)}
          placeholder="Any concerns, blockers, or risk mitigation strategies..."
          rows={3}
          className="md:col-span-2 lg:col-span-3 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
        />
        <InlineTextarea
          label="Account Research"
          value={opportunity.accountResearch || ""}
          onSave={async (value) => handleFieldUpdate("accountResearch", value)}
          placeholder="AI-powered account research and pre-meeting intelligence..."
          rows={6}
          className="md:col-span-2 lg:col-span-3 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
        />
        <InlineTextarea
          label="Notes"
          value={opportunity.notes || ""}
          onSave={async (value) => handleFieldUpdate("notes", value)}
          placeholder="Your personal notes about this opportunity..."
          rows={4}
          className="md:col-span-2 lg:col-span-3"
        />
        <GranolaNotesSection
          opportunityId={opportunity.id}
          notes={opportunity.granolaNotes || []}
        />
        <GongCallsSection
          opportunityId={opportunity.id}
          calls={opportunity.gongCalls || []}
        />
        <GoogleNotesSection
          opportunityId={opportunity.id}
          notes={opportunity.googleNotes || []}
        />
      </div>

      <Separator className="my-8" />

      {/* Organization Chart Section */}
      <OrgChartSection opportunityId={opportunity.id} />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleUpdateOpportunity}
            onCancel={() => setIsEditDialogOpen(false)}
            initialData={{
              name: opportunity.name,
              account: opportunity.account?.name || opportunity.accountName,
              amountArr: opportunity.amountArr,
              probability: opportunity.probability,
              nextStep: opportunity.nextStep,
              closeDate: opportunity.closeDate,
              stage: opportunity.stage,
              forecastCategory: opportunity.forecastCategory,
              riskNotes: opportunity.riskNotes,
              notes: opportunity.notes,
              accountResearch: opportunity.accountResearch,
              ownerId: opportunity.owner.id,
            }}
            submitLabel="Update Opportunity"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Opportunity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{opportunity.name}&quot;? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteOpportunity}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
