"use client";

import { ContentFramework, FRAMEWORK_CATEGORY_LABELS } from "@/types/framework";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FrameworkCardProps {
  framework: ContentFramework;
  isSelected?: boolean;
  onClick?: () => void;
}

export const FrameworkCard = ({
  framework,
  isSelected = false,
  onClick,
}: FrameworkCardProps) => {
  // Parse sections from JSON if needed
  const sections = Array.isArray(framework.sections)
    ? framework.sections
    : [];

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm",
        isSelected && "border-primary ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header with category badge and scope icon */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {FRAMEWORK_CATEGORY_LABELS[framework.category]}
          </Badge>
          <div className="flex items-center text-muted-foreground">
            {framework.scope === "company" ? (
              <Building2 className="h-3.5 w-3.5" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
        </div>

        {/* Framework name */}
        <h3 className="font-semibold text-sm mb-1 line-clamp-1">
          {framework.name}
        </h3>

        {/* Description */}
        {framework.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {framework.description}
          </p>
        )}

        {/* Sections preview */}
        {sections.length > 0 && (
          <div className="space-y-1">
            {sections.slice(0, 3).map((section, index) => (
              <div
                key={index}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{section.title}</span>
              </div>
            ))}
            {sections.length > 3 && (
              <p className="text-xs text-muted-foreground pl-4.5">
                +{sections.length - 3} more sections
              </p>
            )}
          </div>
        )}

        {/* Usage count for popular frameworks */}
        {framework.usageCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Used {framework.usageCount} time{framework.usageCount !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
