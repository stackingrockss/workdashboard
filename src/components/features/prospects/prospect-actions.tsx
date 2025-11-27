"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import { ConvertToOpportunityDialog } from "./convert-to-opportunity-dialog";
import { DeleteAccountDialog } from "./delete-account-dialog";

interface ProspectActionsProps {
  accountId: string;
  accountName: string;
  opportunityCount: number;
  contactCount: number;
}

export function ProspectActions({
  accountId,
  accountName,
  opportunityCount,
  contactCount,
}: ProspectActionsProps) {
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <div className="flex gap-2 w-full">
        <Button
          onClick={() => setShowConvertDialog(true)}
          className="flex-1"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Opportunity
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConvertToOpportunityDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        accountId={accountId}
        accountName={accountName}
      />

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        account={{
          id: accountId,
          name: accountName,
          opportunityCount,
          contactCount,
        }}
        onAccountDeleted={() => {
          setShowDeleteDialog(false);
        }}
      />
    </>
  );
}
