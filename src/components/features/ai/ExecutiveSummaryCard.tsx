import type { MeetingBriefMetadata } from "@/types/opportunity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MessageSquare, TrendingUp, AlertTriangle } from "lucide-react";

interface ExecutiveSummaryCardProps {
  summary: MeetingBriefMetadata["executiveSummary"];
  accountName: string;
}

export const ExecutiveSummaryCard = ({ summary, accountName }: ExecutiveSummaryCardProps) => {
  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span>🎯</span>
          EXECUTIVE SUMMARY: {accountName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">Read this first - 60 second prep</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Critical Insight */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>Critical Insight</span>
          </div>
          <p className="text-sm leading-relaxed pl-7">{summary.criticalInsight}</p>
        </div>

        {/* Opening Line */}
        {summary.openingLine && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400">
              <MessageSquare className="h-5 w-5" />
              <span>Your Opening Line</span>
            </div>
            <blockquote className="border-l-2 border-blue-500 pl-4 italic text-sm">
              &ldquo;{summary.openingLine}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Key Metrics */}
        {summary.keyMetrics && summary.keyMetrics.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-green-600 dark:text-green-400">
              <TrendingUp className="h-5 w-5" />
              <span>Key Data Points to Reference</span>
            </div>
            <div className="pl-7 space-y-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 font-semibold">Metric</th>
                    <th className="text-left py-1 font-semibold">Value</th>
                    <th className="text-left py-1 font-semibold">How to Use</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.keyMetrics.map((metric, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 font-medium">{metric.metric}</td>
                      <td className="py-2">{metric.value}</td>
                      <td className="py-2 text-muted-foreground italic">{metric.talkingPoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Questions */}
        {summary.topQuestions && summary.topQuestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <span>⚡</span>
              <span>Top {summary.topQuestions.length} Questions to Ask</span>
            </div>
            <ol className="pl-7 space-y-1.5 text-sm">
              {summary.topQuestions.map((question, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="font-semibold text-green-600 dark:text-green-400">{idx + 1}.</span>
                  <span>&ldquo;{question}&rdquo;</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Risks */}
        {summary.risks && summary.risks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Risks to Address</span>
            </div>
            <ul className="pl-7 space-y-1.5 text-sm">
              {summary.risks.map((risk, idx) => (
                <li key={idx} className="flex gap-2">
                  <Badge variant="outline" className="shrink-0 h-5">
                    ⚠️
                  </Badge>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
