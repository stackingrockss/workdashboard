"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccountCreateInput,
  AccountUpdateInput,
  accountCreateSchema,
  accountUpdateSchema
} from "@/lib/validations/account";
import { Account, AccountPriority, AccountHealth } from "@/types/account";

interface AccountFormProps {
  account?: Account;
  onSubmit: (data: AccountCreateInput | AccountUpdateInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function AccountForm({ account, onSubmit, onCancel, submitLabel }: AccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AccountCreateInput | AccountUpdateInput>({
    resolver: zodResolver(account ? accountUpdateSchema : accountCreateSchema),
    defaultValues: account || {
      name: "",
      industry: "",
      website: "",
      priority: "medium",
      health: "good",
      notes: "",
    },
  });

  const selectedPriority = watch("priority");
  const selectedHealth = watch("health");

  const handleFormSubmit = async (data: AccountCreateInput | AccountUpdateInput) => {
    setIsSubmitting(true);

    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Account Name *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Enter account name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          {...register("website")}
          placeholder="e.g., company.com or https://company.com"
          disabled={isSubmitting}
        />
        {errors.website && (
          <p className="text-sm text-destructive">{errors.website.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Input
          id="industry"
          {...register("industry")}
          placeholder="e.g., Technology, Healthcare, Finance"
          disabled={isSubmitting}
        />
        {errors.industry && (
          <p className="text-sm text-destructive">{errors.industry.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={selectedPriority}
            onValueChange={(value) => setValue("priority", value as AccountPriority)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-sm text-destructive">{errors.priority.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="health">Health</Label>
          <Select
            value={selectedHealth}
            onValueChange={(value) => setValue("health", value as AccountHealth)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="health">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          {errors.health && (
            <p className="text-sm text-destructive">{errors.health.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          {...register("notes")}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Add any notes about this account"
          disabled={isSubmitting}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
