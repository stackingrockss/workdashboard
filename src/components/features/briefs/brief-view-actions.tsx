"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil, Copy } from "lucide-react";
import { toast } from "sonner";

interface BriefViewActionsProps {
  briefId: string;
  isTemplate: boolean;
  isOwner: boolean;
}

export const BriefViewActions = ({
  briefId,
  isTemplate,
  isOwner,
}: BriefViewActionsProps) => {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const response = await fetch(`/api/v1/briefs/${briefId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to duplicate brief");
      }

      const data = await response.json();
      toast.success("Brief duplicated");
      // Navigate to edit the new brief
      router.push(`/briefs/${data.brief.id}/edit`);
    } catch (error) {
      toast.error("Failed to duplicate brief");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleDuplicate}
        disabled={duplicating}
      >
        <Copy className="h-4 w-4 mr-2" />
        {duplicating ? "Duplicating..." : "Duplicate"}
      </Button>
      {!isTemplate && isOwner && (
        <Button asChild>
          <Link href={`/briefs/${briefId}/edit`}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      )}
    </div>
  );
};
