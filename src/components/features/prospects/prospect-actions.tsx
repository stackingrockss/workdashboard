"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ConvertToOpportunityDialog } from "./convert-to-opportunity-dialog";

interface ProspectActionsProps {
  accountId: string;
  accountName: string;
}

export function ProspectActions({ accountId, accountName }: ProspectActionsProps) {
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  return (
    <>
      <Button
        onClick={() => setShowConvertDialog(true)}
        className="w-full"
        size="sm"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create Opportunity
      </Button>

      <ConvertToOpportunityDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        accountId={accountId}
        accountName={accountName}
      />
    </>
  );
}
