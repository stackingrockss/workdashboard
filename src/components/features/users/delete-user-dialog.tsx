"use client";

import { useState } from "react";
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

interface User {
  id: string;
  name: string;
  email: string;
  opportunityCount: number;
  accountCount: number;
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onUserDeleted: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onUserDeleted,
}: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false);

  const hasData = user.opportunityCount > 0 || user.accountCount > 0;

  async function handleDelete() {
    try {
      setLoading(true);

      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }

      toast.success("User deleted successfully!");
      onUserDeleted();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user"
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
            Delete User
          </DialogTitle>
          <DialogDescription>
            {hasData ? (
              <>
                <strong>{user.name}</strong> has {user.opportunityCount}{" "}
                {user.opportunityCount === 1 ? "opportunity" : "opportunities"} and{" "}
                {user.accountCount} {user.accountCount === 1 ? "account" : "accounts"}.
                <br />
                <br />
                You must reassign their opportunities and accounts to another user before
                deleting this account.
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{user.name}</strong>? This action
                cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasData ? (
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
              {loading ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
