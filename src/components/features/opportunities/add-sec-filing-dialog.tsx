"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  secFilingCreateSchema,
  type SecFilingCreateInput,
} from "@/lib/validations/sec-filing";

interface AddSecFilingDialogProps {
  accountId: string;
  accountTicker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddSecFilingDialog({
  accountId,
  accountTicker,
  open,
  onOpenChange,
  onSuccess,
}: AddSecFilingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<SecFilingCreateInput>({
    resolver: zodResolver(secFilingCreateSchema),
    defaultValues: {
      filingType: "10-K",
      fiscalYear: new Date().getFullYear(),
    },
  });

  const selectedFilingType = watch("filingType");
  const selectedFiscalPeriod = watch("fiscalPeriod");

  const onSubmit = async (data: SecFilingCreateInput) => {
    if (!accountTicker) {
      toast.error("Account must have a ticker symbol to fetch SEC filings");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/accounts/${accountId}/sec-filings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add SEC filing");
      }

      reset();
      onSuccess();
    } catch (error) {
      console.error("Error adding SEC filing:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add SEC filing"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add SEC Filing</DialogTitle>
          <DialogDescription>
            Fetch and analyze a 10-K, 10-Q, or 8-K filing from SEC EDGAR
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filingType">Filing Type</Label>
            <Select
              value={selectedFilingType}
              onValueChange={(value) => setValue("filingType", value as SecFilingCreateInput["filingType"])}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select filing type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10-K">10-K (Annual Report)</SelectItem>
                <SelectItem value="10-Q">10-Q (Quarterly Report)</SelectItem>
                <SelectItem value="8-K">8-K (Current Report)</SelectItem>
              </SelectContent>
            </Select>
            {errors.filingType && (
              <p className="text-sm text-destructive">{errors.filingType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiscalYear">Fiscal Year</Label>
            <Input
              id="fiscalYear"
              type="number"
              placeholder="2024"
              {...register("fiscalYear", { valueAsNumber: true })}
              disabled={isSubmitting}
            />
            {errors.fiscalYear && (
              <p className="text-sm text-destructive">{errors.fiscalYear.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiscalPeriod">Fiscal Period (Optional)</Label>
            <Select
              value={selectedFiscalPeriod}
              onValueChange={(value) => setValue("fiscalPeriod", value as SecFilingCreateInput["fiscalPeriod"])}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FY">FY (Full Year)</SelectItem>
                <SelectItem value="Q1">Q1</SelectItem>
                <SelectItem value="Q2">Q2</SelectItem>
                <SelectItem value="Q3">Q3</SelectItem>
                <SelectItem value="Q4">Q4</SelectItem>
              </SelectContent>
            </Select>
            {errors.fiscalPeriod && (
              <p className="text-sm text-destructive">{errors.fiscalPeriod.message}</p>
            )}
          </div>

          {!accountTicker && (
            <div className="p-3 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Account needs a ticker symbol. Edit the account to add one.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !accountTicker}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Filing"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
