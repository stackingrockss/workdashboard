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
import { Opportunity } from "@/types/opportunity";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { updateOpportunity, deleteOpportunity } from "@/lib/api/opportunities";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { GranolaNotesSection } from "./granola-notes-section";
import { OrgChartSection } from "@/components/contacts/OrgChartSection";
import { Separator } from "@/components/ui/separator";

interface OpportunityDetailClientProps {
  opportunity: Opportunity;
}

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
            Edit
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
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Stage</div>
          <div className="font-medium capitalize">{opportunity.stage}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Amount (ARR)</div>
          <div className="font-medium" suppressHydrationWarning>{formatCurrencyCompact(opportunity.amountArr)} ARR</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Probability</div>
          <div className="font-medium">{opportunity.probability}%</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Close date</div>
          <div className="font-medium" suppressHydrationWarning>{formatDateShort(opportunity.closeDate)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Owner</div>
          <div className="font-medium">{opportunity.owner.name}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Forecast Category</div>
          <div className="font-medium capitalize">{opportunity.forecastCategory ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
          <div className="text-sm text-muted-foreground">Next step</div>
          <div className="font-medium whitespace-pre-wrap">{opportunity.nextStep ?? "—"}</div>
        </div>
        {opportunity.riskNotes && (
          <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <div className="text-sm text-muted-foreground">Risk Notes</div>
            <div className="font-medium whitespace-pre-wrap">{opportunity.riskNotes}</div>
          </div>
        )}
        {opportunity.notes && (
          <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
            <div className="text-sm text-muted-foreground">Notes</div>
            <div className="font-medium whitespace-pre-wrap">{opportunity.notes}</div>
          </div>
        )}
        <GranolaNotesSection
          opportunityId={opportunity.id}
          notes={opportunity.granolaNotes || []}
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
