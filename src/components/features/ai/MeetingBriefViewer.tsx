"use client";

import { useState } from "react";
import type { MeetingBriefMetadata } from "@/types/opportunity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, MessageSquare, HelpCircle, TrendingUp } from "lucide-react";
import { ExecutiveSummaryCard } from "./ExecutiveSummaryCard";
import { MobileCheatSheet } from "./MobileCheatSheet";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MeetingBriefViewerProps {
  accountName: string;
  fullBrief: string;
  mobileCheatSheet: string;
  metadata: MeetingBriefMetadata;
}

export const MeetingBriefViewer = ({
  accountName,
  fullBrief,
  mobileCheatSheet,
  metadata,
}: MeetingBriefViewerProps) => {
  const [view, setView] = useState<"full" | "mobile">("full");

  // Extract background content (sections after executive summary)
  const backgroundContent = fullBrief.split("## 1.").slice(1).join("## 1.");

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={(v) => setView(v as "full" | "mobile")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="full">Full Brief</TabsTrigger>
          <TabsTrigger value="mobile">Mobile Cheat Sheet</TabsTrigger>
        </TabsList>

        {/* Full Brief View */}
        <TabsContent value="full" className="space-y-6 mt-6">
          {/* Executive Summary - Always Visible */}
          <ExecutiveSummaryCard summary={metadata.executiveSummary} accountName={accountName} />

          {/* Quick Reference Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>📱</span>
              Quick Reference (During Call)
            </h2>

            {/* Conversation Starters */}
            <Collapsible defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                        <span>💬 Conversation Starters</span>
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {metadata.quickReference.conversationStarters.map((starter, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 rounded text-sm"
                      >
                        {starter}
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Discovery Questions */}
            <Collapsible defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-green-600" />
                        <span>❓ Discovery Questions</span>
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {metadata.quickReference.discoveryQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${
                          q.priority === "HIGH"
                            ? "border-red-500 bg-red-50 dark:bg-red-950"
                            : q.priority === "MEDIUM"
                              ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                              : "border-gray-500 bg-gray-50 dark:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <Badge
                            variant={q.priority === "HIGH" ? "destructive" : "secondary"}
                            className="shrink-0"
                          >
                            {q.priority === "HIGH" ? "🔴 HIGH" : q.priority === "MEDIUM" ? "🟡 MEDIUM" : "⚪ OPTIONAL"}
                          </Badge>
                        </div>
                        <p className="font-semibold mb-2 text-sm">&ldquo;{q.question}&rdquo;</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>
                            <span className="font-semibold">Why ask:</span> {q.whyAsk}
                          </p>
                          <div>
                            <span className="font-semibold">Listen for:</span>
                            <ul className="list-disc list-inside ml-2">
                              {q.listenFor.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Key Financials */}
            {metadata.quickReference.financials && metadata.quickReference.financials.length > 0 && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <span>📊 Key Financials</span>
                        </div>
                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-semibold">Metric</th>
                              <th className="text-left py-2 font-semibold">Value</th>
                              <th className="text-left py-2 font-semibold">YoY Change</th>
                              <th className="text-left py-2 font-semibold">How to Use This</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metadata.quickReference.financials.map((metric, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="py-2 font-medium">{metric.metric}</td>
                                <td className="py-2">{metric.value}</td>
                                <td className="py-2">{metric.yoyChange}</td>
                                <td className="py-2 text-muted-foreground italic">{metric.howToUse}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>

          {/* Background Context - Collapsed by Default */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <span>📚</span>
                      <span>Background Context (Pre-Call Prep)</span>
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CardTitle>
                  <p className="text-sm text-muted-foreground px-6 pb-4">
                    Detailed company intel, tech stack, and competitive analysis
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
                      {backgroundContent}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* Mobile Cheat Sheet View */}
        <TabsContent value="mobile" className="mt-6">
          <MobileCheatSheet cheatSheet={mobileCheatSheet} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
