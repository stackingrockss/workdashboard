"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, TrendingUp, Target, LayoutGrid, Loader2 } from "lucide-react";
import { getColumnTemplates, type ColumnTemplateType } from "@/lib/templates/column-templates";

const iconMap = {
  CalendarDays,
  TrendingUp,
  Target,
  LayoutGrid,
};

interface ColumnTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: ColumnTemplateType) => Promise<void>;
  fiscalYearStartMonth?: number;
}

export function ColumnTemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  fiscalYearStartMonth = 1,
}: ColumnTemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ColumnTemplateType | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const templates = getColumnTemplates(fiscalYearStartMonth);

  const handleApplyTemplate = async (templateId: ColumnTemplateType) => {
    setIsApplying(true);
    setSelectedTemplate(templateId);
    try {
      await onSelectTemplate(templateId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to apply template:", error);
    } finally {
      setIsApplying(false);
      setSelectedTemplate(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Column Template</DialogTitle>
          <DialogDescription>
            Select a template to quickly set up your Kanban board. You can customize columns after applying.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {templates.map((template) => {
            const Icon = iconMap[template.icon as keyof typeof iconMap];
            const isSelected = selectedTemplate === template.id;
            const isApplyingThis = isApplying && isSelected;

            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => !isApplying && handleApplyTemplate(template.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Columns to create: {template.columns.length || "None (start blank)"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {template.columns.length > 0 ? (
                          template.columns.map((col, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                              style={
                                col.color
                                  ? {
                                      borderColor: col.color,
                                      color: col.color,
                                    }
                                  : undefined
                              }
                            >
                              {col.title}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Start with a blank canvas
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      variant={isSelected ? "default" : "outline"}
                      disabled={isApplying}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyTemplate(template.id);
                      }}
                    >
                      {isApplyingThis ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        "Apply Template"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Applying a template will not delete your existing columns. New columns will be added to your board.
            You can edit or remove columns at any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
