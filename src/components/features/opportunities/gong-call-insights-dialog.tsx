"use client";

/**
 * GongCallInsightsDialog Component
 *
 * Displays stored parsed insights from a Gong call transcript:
 * - Pain points
 * - Goals
 * - People
 * - Next steps
 *
 * Allows user to import contacts from the parsed people list.
 */

import { useState } from "react";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContactImportReview } from "@/components/contacts/ContactImportReview";
import { BulkImportResult } from "@/lib/api/contacts";
import {
  AlertTriangle,
  Target,
  Users,
  ListChecks,
  Copy,
  Check,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface GongCallInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gongCallTitle: string;
  opportunityId: string;
  insights: {
    painPoints: string[];
    goals: string[];
    people: PersonExtracted[];
    nextSteps: string[];
  };
  onContactsImported?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function GongCallInsightsDialog({
  open,
  onOpenChange,
  gongCallTitle,
  opportunityId,
  insights,
  onContactsImported,
}: GongCallInsightsDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [showContactImport, setShowContactImport] = useState(false);

  // Debug: Log insights data when dialog opens
  console.log('GongCallInsightsDialog insights:', {
    painPointsLength: insights.painPoints?.length,
    goalsLength: insights.goals?.length,
    peopleLength: insights.people?.length,
    nextStepsLength: insights.nextSteps?.length,
    painPoints: insights.painPoints,
    goals: insights.goals,
  });

  // Copy section to clipboard
  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    toast.success(`${sectionName} copied to clipboard`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Handle contact import completion
  const handleImportComplete = (result: BulkImportResult) => {
    setShowContactImport(false);
    onContactsImported?.();
  };

  // Render section with copy button
  const renderSection = (
    title: string,
    items: string[],
    icon: React.ReactNode,
    emptyMessage: string
  ) => {
    const isEmpty = items.length === 0;
    const textContent = items.join("\n");

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h4>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(textContent, title)}
            >
              {copiedSection === title ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {isEmpty ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={index}
                className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
              >
                <span className="text-slate-400 mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Render people section with table
  const renderPeopleSection = () => {
    const isEmpty = insights.people.length === 0;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              People
            </h4>
            <Badge variant="secondary">{insights.people.length}</Badge>
          </div>
          <div className="flex gap-2">
            {!isEmpty && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const text = insights.people
                      .map(
                        (p) => `${p.name} - ${p.role} at ${p.organization}`
                      )
                      .join("\n");
                    copyToClipboard(text, "People");
                  }}
                >
                  {copiedSection === "People" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowContactImport(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Import as Contacts
                </Button>
              </>
            )}
          </div>
        </div>

        {isEmpty ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            No people found in transcript
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-900 dark:text-slate-100">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900 dark:text-slate-100">
                    Organization
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900 dark:text-slate-100">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {insights.people.map((person, index) => (
                  <tr
                    key={index}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {person.name}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {person.organization}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {person.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transcript Insights</DialogTitle>
          <DialogDescription>{gongCallTitle}</DialogDescription>
        </DialogHeader>

        {showContactImport ? (
          <div className="py-4">
            <ContactImportReview
              people={insights.people}
              opportunityId={opportunityId}
              onImportComplete={handleImportComplete}
              onCancel={() => setShowContactImport(false)}
            />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Pain Points */}
            {renderSection(
              "Pain Points",
              insights.painPoints,
              <AlertTriangle className="h-5 w-5 text-orange-600" />,
              "No pain points identified"
            )}

            <Separator />

            {/* Goals */}
            {renderSection(
              "Goals",
              insights.goals,
              <Target className="h-5 w-5 text-blue-600" />,
              "No goals identified"
            )}

            <Separator />

            {/* People */}
            {renderPeopleSection()}

            <Separator />

            {/* Next Steps */}
            {renderSection(
              "Next Steps",
              insights.nextSteps,
              <ListChecks className="h-5 w-5 text-green-600" />,
              "No next steps identified"
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
