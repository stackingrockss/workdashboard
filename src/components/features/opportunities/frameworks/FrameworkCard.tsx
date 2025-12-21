"use client";

import { ContentBrief, BRIEF_CATEGORY_LABELS } from "@/types/brief";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, FileText, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface BriefCardProps {
  brief: ContentBrief;
  isSelected?: boolean;
  onClick?: () => void;
  showEditButton?: boolean;
}

export const BriefCard = ({
  brief,
  isSelected = false,
  onClick,
  showEditButton = false,
}: BriefCardProps) => {
  // Note: This component was renamed from FrameworkCard to BriefCard
  // The export alias below maintains backwards compatibility
  const router = useRouter();

  // Parse sections from JSON if needed
  const sections = Array.isArray(brief.sections)
    ? brief.sections
    : [];

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/briefs/${brief.id}/edit`);
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm",
        isSelected && "border-primary ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header with category badge, scope icon, and edit button */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {BRIEF_CATEGORY_LABELS[brief.category]}
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            {showEditButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleEdit}
                title="Edit brief"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {brief.scope === "company" ? (
              <Building2 className="h-3.5 w-3.5" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
        </div>

        {/* Brief name */}
        <h3 className="font-semibold text-sm mb-1 line-clamp-1">
          {brief.name}
        </h3>

        {/* Description */}
        {brief.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {brief.description}
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

        {/* Usage count for popular briefs */}
        {brief.usageCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Used {brief.usageCount} time{brief.usageCount !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Backwards compatibility alias - deprecated, use BriefCard instead
/** @deprecated Use BriefCard instead */
export const FrameworkCard = BriefCard;
