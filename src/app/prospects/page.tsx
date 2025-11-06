import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ProspectActions } from "@/components/features/prospects/prospect-actions";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  // Fetch accounts WITHOUT opportunities (true prospects)
  const accountsFromDB = await prisma.account.findMany({
    where: {
      opportunities: {
        none: {}, // Key filter: only accounts with zero opportunities
      },
    },
    include: {
      contacts: true,
      opportunities: true, // Still include for count display (will be 0)
    },
    orderBy: [
      { priority: "desc" }, // High priority first
      { name: "asc" },
    ],
  });

  const accounts = accountsFromDB;

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
          <h1 className="text-3xl font-semibold tracking-tight">Prospects</h1>
          <p className="text-muted-foreground">
            Target accounts without active opportunities - build relationships before converting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {accounts.length} {accounts.length === 1 ? "prospect" : "prospects"}
          </Badge>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No prospects without opportunities</h3>
            <p className="text-sm text-muted-foreground">
              All your accounts have been converted to opportunities. Great work!
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Add new accounts to start building new prospect relationships.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow h-full relative group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Link href={`/prospects/${account.id}`} className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="truncate hover:text-primary transition-colors">
                      {account.name}
                    </CardTitle>
                    {account.industry && (
                      <p className="text-sm text-muted-foreground">{account.industry}</p>
                    )}
                  </Link>
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
                    <span className="text-muted-foreground">Contacts</span>
                    <span className="font-medium">{account.contacts.length}</span>
                  </div>
                </div>

                {account.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground line-clamp-2">{account.notes}</p>
                  </div>
                )}

                {account.contacts.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Key Contacts</p>
                    <div className="space-y-1">
                      {account.contacts.slice(0, 3).map((contact) => (
                        <div key={contact.id} className="block text-sm truncate">
                          {contact.firstName} {contact.lastName}
                          {contact.title && (
                            <span className="text-muted-foreground"> • {contact.title}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Call-to-action: Convert to Opportunity */}
                <div className="pt-4 border-t">
                  <ProspectActions accountId={account.id} accountName={account.name} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
