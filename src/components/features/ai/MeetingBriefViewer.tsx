"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { RichTextViewer } from "@/components/ui/rich-text-editor";

interface MeetingBriefViewerProps {
  accountName: string;
  fullBrief: string;
}

export const MeetingBriefViewer = ({
  accountName,
  fullBrief,
}: MeetingBriefViewerProps) => {
  return (
    <div className="space-y-6">
      {/* Background Context */}
      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <span>📚</span>
                  <span>Background Context for {accountName}</span>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CardTitle>
              <p className="text-sm text-muted-foreground px-6 pb-4">
                AI-generated company research and analysis
              </p>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="text-sm">
                <RichTextViewer content={fullBrief} />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
