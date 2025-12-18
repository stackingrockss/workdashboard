"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import { AddAccountDialog } from "./add-account-dialog";

interface ProspectsPageHeaderProps {
  accountCount: number;
}

export function ProspectsPageHeader({ accountCount }: ProspectsPageHeaderProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Prospects</h1>
            <p className="text-sm text-muted-foreground">
              Accounts without opportunities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xl font-semibold">{accountCount}</p>
            <p className="text-xs text-muted-foreground">
              {accountCount === 1 ? "Prospect" : "Prospects"}
            </p>
          </div>
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
