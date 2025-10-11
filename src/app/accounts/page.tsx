import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { Building2, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  // Fetch accounts with their opportunities
  const accountsFromDB = await prisma.account.findMany({
    include: {
      opportunities: {
        include: {
          owner: true,
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Calculate stats for each account
  const accounts = accountsFromDB.map(account => {
    const totalOpportunities = account.opportunities.length;
    const totalValue = account.opportunities.reduce((sum, opp) => sum + opp.amountArr, 0);
    const weightedValue = account.opportunities.reduce(
      (sum, opp) => sum + (opp.amountArr * opp.probability) / 100,
      0
    );
    const avgProbability = totalOpportunities > 0
      ? account.opportunities.reduce((sum, opp) => sum + opp.probability, 0) / totalOpportunities
      : 0;

    return {
      ...account,
      stats: {
        totalOpportunities,
        totalValue,
        weightedValue,
        avgProbability,
      },
    };
  });

  const priorityColors = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  };

  const healthIcons = {
    good: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    "at-risk": <AlertCircle className="h-4 w-4 text-yellow-500" />,
    critical: <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Manage and prioritize key accounts</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
            <p className="text-sm text-muted-foreground">
              Accounts will be automatically created when you add opportunities
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(account => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="truncate">{account.name}</CardTitle>
                    {account.industry && (
                      <p className="text-sm text-muted-foreground">{account.industry}</p>
                    )}
                  </div>
                  {healthIcons[account.health as keyof typeof healthIcons]}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Badge className={priorityColors[account.priority as keyof typeof priorityColors]}>
                    {account.priority.charAt(0).toUpperCase() + account.priority.slice(1)} Priority
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Opportunities</span>
                    <span className="font-medium">{account.stats.totalOpportunities}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-medium">{formatCurrencyCompact(account.stats.totalValue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Weighted Value</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyCompact(account.stats.weightedValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg Probability</span>
                    <span className="font-medium">{account.stats.avgProbability.toFixed(0)}%</span>
                  </div>
                </div>

                {account.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground line-clamp-2">{account.notes}</p>
                  </div>
                )}

                {account.opportunities.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recent Opportunities</p>
                    <div className="space-y-1">
                      {account.opportunities.slice(0, 3).map(opp => (
                        <Link
                          key={opp.id}
                          href={`/opportunities/${opp.id}`}
                          className="block text-sm hover:underline truncate"
                        >
                          {opp.name} • {formatCurrencyCompact(opp.amountArr)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
