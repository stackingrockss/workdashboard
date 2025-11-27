"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountForm } from "@/components/forms/account-form";
import { AccountCreateInput, AccountUpdateInput } from "@/lib/validations/account";
import { toast } from "sonner";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: () => void;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
}: AddAccountDialogProps) {
  const router = useRouter();

  const handleSubmit = async (data: AccountCreateInput | AccountUpdateInput) => {
    try {
      const res = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create account");
      }

      toast.success("Account created successfully!");
      onAccountCreated();
      router.refresh();
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create account"
      );
      throw error; // Re-throw to let AccountForm handle loading state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Create a new prospect account. You can convert it to an opportunity later.
          </DialogDescription>
        </DialogHeader>

        <AccountForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Create Account"
        />
      </DialogContent>
    </Dialog>
  );
}
