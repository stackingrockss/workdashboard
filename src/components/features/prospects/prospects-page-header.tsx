"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { AddAccountDialog } from "./add-account-dialog";

interface ProspectsPageHeaderProps {
  accountCount: number;
}

export function ProspectsPageHeader({ accountCount }: ProspectsPageHeaderProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prospects</h1>
          <p className="text-muted-foreground">
            Accounts without opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {accountCount} {accountCount === 1 ? "prospect" : "prospects"}
          </Badge>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      <AddAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAccountCreated={() => {
          setShowAddDialog(false);
        }}
      />
    </>
  );
}
