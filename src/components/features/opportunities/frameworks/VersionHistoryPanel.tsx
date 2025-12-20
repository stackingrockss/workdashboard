"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, RotateCcw, Clock, User, Check, Loader2 } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  version: number;
  createdAt: Date | string;
  generatedAt?: Date | string | null;
  generationStatus: string;
  createdBy?: {
    id: string;
    name: string | null;
  };
}

interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  contentId: string;
  currentVersion: number;
  onRestore: (versionId: string) => void;
}

export const VersionHistoryPanel = ({
  open,
  onOpenChange,
  opportunityId,
  contentId,
  currentVersion,
  onRestore,
}: VersionHistoryPanelProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const fetchVersions = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/generated-content/${contentId}`
        );
        if (response.ok) {
          const data = await response.json();
          setVersions(data.versions || []);
        }
      } catch (error) {
        console.error("Failed to fetch versions:", error);
        toast.error("Failed to load version history");
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [open, opportunityId, contentId]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/generated-content/${contentId}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore version");
      }

      toast.success("Version restored successfully");
      onRestore(versionId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to restore version:", error);
      toast.error("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          <div className="space-y-2 pr-4">
            {loading ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No version history available
              </p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className={cn(
                    "p-3 border rounded-lg transition-colors",
                    version.version === currentVersion &&
                      "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{version.version}</Badge>
                      {version.version === currentVersion && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                      {version.generationStatus === "completed" && (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      )}
                    </div>
                    {version.version !== currentVersion &&
                      version.generationStatus === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(version.id)}
                          disabled={restoring === version.id}
                        >
                          {restoring === version.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Restore
                            </>
                          )}
                        </Button>
                      )}
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {version.generatedAt
                          ? formatDateShort(version.generatedAt)
                          : formatDateShort(version.createdAt)}
                      </span>
                    </div>
                    {version.createdBy?.name && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{version.createdBy.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
