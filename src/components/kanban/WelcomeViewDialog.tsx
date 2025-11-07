"use client";

/**
 * WelcomeViewDialog Component
 * Onboarding dialog for new users to choose their first view
 */

import { useState } from "react";
import { CalendarDays, TrendingUp, Target, LayoutGrid, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ViewType } from "@prisma/client";
import { VIEW_TYPE_LABELS, VIEW_TYPE_DESCRIPTIONS } from "@/types/view";

const iconMap = {
  quarterly: CalendarDays,
  stages: TrendingUp,
  forecast: Target,
  custom: LayoutGrid,
};

interface WelcomeViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectViewType: (viewType: ViewType) => Promise<void>;
}

export function WelcomeViewDialog({
  open,
  onOpenChange,
  onSelectViewType,
}: WelcomeViewDialogProps) {
  const [selectedType, setSelectedType] = useState<ViewType | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const viewOptions: Array<{ type: ViewType; icon: keyof typeof iconMap }> = [
    { type: "quarterly", icon: "quarterly" },
    { type: "stages", icon: "stages" },
    { type: "forecast", icon: "forecast" },
    { type: "custom", icon: "custom" },
  ];

  const handleSelectType = async (viewType: ViewType) => {
    setSelectedType(viewType);
    setIsCreating(true);

    try {
      await onSelectViewType(viewType);
      onOpenChange(false);

      // Mark welcome as seen
      localStorage.setItem("kanban-welcome-seen", "true");
    } catch (error) {
      console.error("Error creating view:", error);
    } finally {
      setIsCreating(false);
      setSelectedType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Your Kanban Board!</DialogTitle>
          <DialogDescription className="text-base">
            Choose how you&apos;d like to organize your opportunities. You can always create more views or switch between them later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {viewOptions.map((option) => {
            const Icon = iconMap[option.icon];
            const isSelected = selectedType === option.type;
            const isCreatingThis = isCreating && isSelected;

            return (
              <Card
                key={option.type}
                className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => !isCreating && handleSelectType(option.type)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {VIEW_TYPE_LABELS[option.type]}
                      </CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        {VIEW_TYPE_DESCRIPTIONS[option.type]}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full"
                    variant={isSelected ? "default" : "outline"}
                    disabled={isCreating}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isCreating) handleSelectType(option.type);
                    }}
                  >
                    {isCreatingThis ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      "Select"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 text-sm text-muted-foreground text-center">
          💡 Tip: Built-in views (Quarterly, Stages, Forecast) are read-only. Choose &quot;Custom&quot; to create your own editable columns.
        </div>
      </DialogContent>
    </Dialog>
  );
}
