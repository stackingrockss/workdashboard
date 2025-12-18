"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/AccountForm";
import { AccountCreateInput, AccountUpdateInput } from "@/lib/validations/account";
import { toast } from "sonner";
import { Building2, ExternalLink } from "lucide-react";

interface ExistingAccount {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
}

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: (accountId?: string) => void;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
}: AddAccountDialogProps) {
  const router = useRouter();
  const [duplicateAccount, setDuplicateAccount] = useState<ExistingAccount | null>(null);

  const handleSubmit = async (data: AccountCreateInput | AccountUpdateInput) => {
    try {
      const res = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (!res.ok) {
        // Check if it's a duplicate error
        if (res.status === 409 && responseData.error === "duplicate") {
          setDuplicateAccount(responseData.existingAccount);
          return; // Don't throw - we're handling this gracefully
        }
        throw new Error(responseData.error || "Failed to create account");
      }

      toast.success("Account created successfully!");
      setDuplicateAccount(null);
      onAccountCreated(responseData.account?.id);
      router.refresh();
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create account"
      );
      throw error; // Re-throw to let AccountForm handle loading state
    }
  };

  const handleUseExisting = () => {
    if (duplicateAccount) {
      toast.success(`Using existing account: ${duplicateAccount.name}`);
      setDuplicateAccount(null);
      onAccountCreated(duplicateAccount.id);
      onOpenChange(false);
      router.refresh();
    }
  };

  const handleTryDifferentName = () => {
    setDuplicateAccount(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDuplicateAccount(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Create a new prospect account. You can convert it to an opportunity later.
          </DialogDescription>
        </DialogHeader>

        {duplicateAccount ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{duplicateAccount.name}</p>
                  {duplicateAccount.industry && (
                    <p className="text-sm text-muted-foreground">
                      {duplicateAccount.industry}
                    </p>
                  )}
                  {duplicateAccount.website && (
                    <a
                      href={duplicateAccount.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {duplicateAccount.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              An account with this name already exists. Would you like to use the existing account?
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTryDifferentName}
                className="flex-1"
              >
                Try different name
              </Button>
              <Button onClick={handleUseExisting} className="flex-1">
                Use existing account
              </Button>
            </div>
          </div>
        ) : (
          <AccountForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            submitLabel="Create Account"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
