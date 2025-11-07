"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";
import { OrgChartSection } from "@/components/contacts/OrgChartSection";
import { ConvertToOpportunityDialog } from "./convert-to-opportunity-dialog";

interface ProspectDetailClientProps {
  account: {
    id: string;
    name: string;
    industry?: string;
    priority: string;
    health: string;
    notes?: string;
    opportunities: Array<{
      id: string;
      name: string;
      amountArr: number;
      stage: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}

export function ProspectDetailClient({ account }: ProspectDetailClientProps) {
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  const priorityColors = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  };

  const healthColors = {
    good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
    "at-risk": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/prospects">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Prospects
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          {account.industry && (
            <p className="text-sm text-muted-foreground">{account.industry}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={() => setIsConvertDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Convert to Opportunity
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={priorityColors[account.priority as keyof typeof priorityColors]}>
              {account.priority.charAt(0).toUpperCase() + account.priority.slice(1)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={healthColors[account.health as keyof typeof healthColors]}>
              {account.health === "at-risk" ? "At Risk" : account.health.charAt(0).toUpperCase() + account.health.slice(1)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Related Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{account.opportunities.length}</div>
          </CardContent>
        </Card>
      </div>

      {account.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{account.notes}</p>
          </CardContent>
        </Card>
      )}

      <OrgChartSection
        parentId={account.id}
        parentType="account"
        apiEndpoint={`/api/v1/accounts/${account.id}/contacts`}
      />

      {account.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {account.opportunities.map(opp => (
                <Link
                  key={opp.id}
                  href={`/opportunities/${opp.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{opp.name}</span>
                    <span className="text-sm text-muted-foreground">{opp.stage}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConvertToOpportunityDialog
        open={isConvertDialogOpen}
        onOpenChange={setIsConvertDialogOpen}
        accountId={account.id}
        accountName={account.name}
      />
    </div>
  );
}
