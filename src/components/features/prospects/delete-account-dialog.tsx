"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface Account {
  id: string;
  name: string;
  opportunityCount: number;
  contactCount: number;
}

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
  onAccountDeleted: () => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  account,
  onAccountDeleted,
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const hasOpportunities = account.opportunityCount > 0;

  async function handleDelete() {
    try {
      setLoading(true);

      const res = await fetch(`/api/v1/accounts/${account.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete account");
      }

      toast.success("Account deleted successfully!");
      onAccountDeleted();
      router.refresh();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            {hasOpportunities ? (
              <>
                <strong>{account.name}</strong> has {account.opportunityCount}{" "}
                {account.opportunityCount === 1 ? "opportunity" : "opportunities"}.
                <br />
                <br />
                You cannot delete an account with opportunities. Please delete the opportunities first or convert this to a regular account.
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{account.name}</strong>?
                {account.contactCount > 0 && (
                  <>
                    {" "}
                    This will also delete {account.contactCount}{" "}
                    {account.contactCount === 1 ? "contact" : "contacts"} associated with this account.
                  </>
                )}
                <br />
                <br />
                This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasOpportunities ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
