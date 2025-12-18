"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Loader2 } from "lucide-react";
import { OpportunityCard, OpportunityCardProps } from "./OpportunityCard";

interface DraggableOpportunityCardProps extends OpportunityCardProps {
  isMoving?: boolean;
}

export function DraggableOpportunityCard({ opportunity, onClick, isMoving }: DraggableOpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative">
      <OpportunityCard opportunity={opportunity} onClick={onClick} />
      {isMoving && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
