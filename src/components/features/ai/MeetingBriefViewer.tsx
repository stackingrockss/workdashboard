"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
              <div className="markdown-content text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-4">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-muted pl-4 italic my-3 text-muted-foreground">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {fullBrief}
                </ReactMarkdown>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
