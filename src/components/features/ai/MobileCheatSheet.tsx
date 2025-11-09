"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface MobileCheatSheetProps {
  cheatSheet: string;
}

export const MobileCheatSheet = ({ cheatSheet }: MobileCheatSheetProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cheatSheet);
      setCopied(true);
      toast.success("Copied to clipboard! Paste into your phone notes or Slack.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please try again.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Cheat Sheet
          </CardTitle>
          <Button onClick={handleCopy} size="sm" variant={copied ? "default" : "outline"}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Quick reference for during the call</p>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
          {cheatSheet}
        </pre>
      </CardContent>
    </Card>
  );
};
