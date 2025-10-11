"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function OpportunitiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Opportunities page error:", error);
  }, [error]);

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-semibold">Something went wrong!</h2>
        <p className="text-muted-foreground">
          Failed to load opportunities. Please try again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
