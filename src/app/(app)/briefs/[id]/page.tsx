import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { getTemplateBriefById, isTemplateBriefId } from "@/lib/briefs/template-briefs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Building2, User, LayoutTemplate } from "lucide-react";
import { BRIEF_CATEGORY_LABELS } from "@/types/brief";
import { formatDateShort } from "@/lib/format";
import { BriefViewActions } from "@/components/features/briefs/brief-view-actions";

export const dynamic = "force-dynamic";

interface ViewBriefPageProps {
  params: Promise<{ id: string }>;
}

/**
 * View Brief Page
 * Displays brief details in read-only mode
 * Supports both database briefs and template briefs
 */
export default async function ViewBriefPage({ params }: ViewBriefPageProps) {
  const user = await requireAuth();
  const { id } = await params;

  let brief;
  let isTemplate = false;
  let isOwner = false;

  // Check if viewing a template brief
  if (isTemplateBriefId(id)) {
    const templateBrief = getTemplateBriefById(id);
    if (!templateBrief) {
      notFound();
    }
    brief = templateBrief;
    isTemplate = true;
  } else {
    // Fetch from database
    const dbBrief = await prisma.contentBrief.findFirst({
      where: {
        id,
        OR: [
          { scope: "personal", createdById: user.id },
          { scope: "company", organizationId: user.organization.id },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!dbBrief) {
      notFound();
    }
    brief = dbBrief;
    isOwner = dbBrief.createdById === user.id;
  }

  const sections = (brief.sections as { title: string; description?: string; required?: boolean }[]) || [];
  const contextConfig = brief.contextConfig as { meetings?: boolean; files?: boolean; notes?: boolean; accountResearch?: boolean } | null;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/briefs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {isTemplate ? (
                <LayoutTemplate className="h-5 w-5 text-primary" />
              ) : brief.scope === "company" ? (
                <Building2 className="h-5 w-5 text-primary" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{brief.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">
                  {BRIEF_CATEGORY_LABELS[brief.category]}
                </Badge>
                <Badge variant="secondary">
                  {isTemplate ? "Template" : brief.scope === "company" ? "Company" : "Personal"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <BriefViewActions
          briefId={brief.id}
          isTemplate={isTemplate}
          isOwner={isOwner}
        />
      </div>

      {/* Description */}
      {brief.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{brief.description}</p>
          </CardContent>
        </Card>
      )}

      {/* System Instruction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Instruction</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono">
            {brief.systemInstruction}
          </pre>
        </CardContent>
      </Card>

      {/* Output Format */}
      {brief.outputFormat && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Output Format</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono">
              {brief.outputFormat}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{section.title}</span>
                      {section.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    {section.description && (
                      <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Configuration */}
      {contextConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Context Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {contextConfig.meetings && (
                <Badge variant="outline">Meetings</Badge>
              )}
              {contextConfig.files && (
                <Badge variant="outline">Files</Badge>
              )}
              {contextConfig.notes && (
                <Badge variant="outline">Notes</Badge>
              )}
              {contextConfig.accountResearch && (
                <Badge variant="outline">Account Research</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {isTemplate ? (
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">Built-in Template</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-medium">{formatDateShort(brief.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last Updated</dt>
                  <dd className="font-medium">{formatDateShort(brief.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Usage Count</dt>
                  <dd className="font-medium">{brief.usageCount} uses</dd>
                </div>
                {"createdBy" in brief && brief.createdBy?.name && (
                  <div>
                    <dt className="text-muted-foreground">Created By</dt>
                    <dd className="font-medium">{brief.createdBy.name}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
