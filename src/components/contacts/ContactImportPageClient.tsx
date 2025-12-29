// src/components/contacts/ContactImportPageClient.tsx
// Full-page client component for importing contacts from parsed transcripts

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContactImportReview } from "./ContactImportReview";
import { formatDateShort } from "@/lib/format";
import type { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type { BulkImportResult } from "@/lib/api/contacts";

interface ContactImportPageClientProps {
  opportunity: {
    id: string;
    name: string;
    accountName?: string;
  };
  callTitle: string;
  meetingDate: string | null;
  parsedPeople: PersonExtracted[];
  sourceType: "gong" | "granola";
  sourceId: string;
  notificationId?: string;
}

export function ContactImportPageClient({
  opportunity,
  callTitle,
  meetingDate,
  parsedPeople,
  sourceType,
  sourceId,
  notificationId,
}: ContactImportPageClientProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleGoToOpportunity = () => {
    router.push(`/opportunities/${opportunity.id}`);
  };

  const handleImportComplete = (result: BulkImportResult) => {
    // Navigate to opportunity after successful import
    router.push(`/opportunities/${opportunity.id}`);
  };

  const handleCancel = () => {
    router.back();
  };

  const handleDontImport = () => {
    // Just go back without importing
    router.back();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Go back</span>
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold truncate">Import Contacts</h1>
                <p className="text-sm text-muted-foreground truncate">
                  Review and import contacts from meeting transcript
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleGoToOpportunity} className="hidden sm:flex">
              View Opportunity
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Context Card */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {/* Opportunity */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">Opportunity</span>
                <span className="text-sm font-medium truncate block">{opportunity.name}</span>
              </div>
            </div>

            {/* Account */}
            {opportunity.accountName && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground block">Account</span>
                  <span className="text-sm font-medium truncate block">{opportunity.accountName}</span>
                </div>
              </div>
            )}

            {/* Meeting */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">Meeting</span>
                <span className="text-sm font-medium truncate block">{callTitle}</span>
              </div>
            </div>

            {/* Date */}
            {meetingDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground block">Date</span>
                  <span className="text-sm font-medium block">
                    {formatDateShort(new Date(meetingDate))}
                  </span>
                </div>
              </div>
            )}

            {/* Source Badge */}
            <div className="flex items-center">
              <Badge variant="secondary" className="capitalize">
                {sourceType === "gong" ? "Gong Call" : "Granola Note"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Import Review Component */}
        <div className="bg-card border rounded-lg p-6">
          <ContactImportReview
            people={parsedPeople}
            opportunityId={opportunity.id}
            onImportComplete={handleImportComplete}
            onCancel={handleCancel}
            onDontImport={handleDontImport}
          />
        </div>
      </div>
    </div>
  );
}
