"use client";

/**
 * ContactImportReview Component
 *
 * Displays extracted people from parsed Gong transcripts and allows users to:
 * - Review each person's details (name, organization, role)
 * - See AI-classified Contact role (decision_maker, influencer, etc.)
 * - Check for potential duplicate contacts
 * - Select which contacts to import
 * - Override suggested roles before import
 * - Bulk import selected contacts to the opportunity
 */

import { useState, useEffect } from "react";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import { splitFullName } from "@/lib/utils/contact-duplicate-detection";
import { bulkCreateContacts, type BulkImportResult } from "@/lib/api/contacts";
import { ContactBulkImportItem } from "@/lib/validations/contact";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, AlertTriangle, CheckCircle2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ContactImportItem {
  person: PersonExtracted;
  selected: boolean;
  overrideRole?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

interface ContactImportReviewProps {
  people: PersonExtracted[];
  opportunityId: string;
  onImportComplete?: (result: BulkImportResult) => void;
  onCancel?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ContactImportReview({
  people,
  opportunityId,
  onImportComplete,
  onCancel,
}: ContactImportReviewProps) {
  const [contacts, setContacts] = useState<ContactImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // Initialize contacts from people
  useEffect(() => {
    const initialContacts = people.map((person) => ({
      person,
      selected: true, // Select all by default
      overrideRole: person.classifiedRole || "end_user",
      isDuplicate: false,
    }));
    setContacts(initialContacts);

    // Check for duplicates
    checkForDuplicates(initialContacts);
  }, [people]);

  // Check for duplicates (client-side API call)
  const checkForDuplicates = async (contactList: ContactImportItem[]) => {
    setIsCheckingDuplicates(true);
    try {
      // For each contact, check if duplicate exists
      // Note: This is a simplified version - in production, you'd call a batch API endpoint
      const updatedContacts = [...contactList];

      for (let i = 0; i < updatedContacts.length; i++) {
        const person = updatedContacts[i].person;
        const { firstName, lastName } = splitFullName(person.name);

        // Call duplicate check API
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/contacts/check-duplicate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstName, lastName, email: null }),
          }
        );

        if (response.ok) {
          const duplicateCheck = await response.json();
          if (duplicateCheck.isDuplicate && duplicateCheck.matches.length > 0) {
            updatedContacts[i].isDuplicate = true;
            updatedContacts[i].duplicateReason = `Similar to: ${duplicateCheck.matches[0].firstName} ${duplicateCheck.matches[0].lastName}`;
          }
        }
      }

      setContacts(updatedContacts);
    } catch (error) {
      console.error("Error checking duplicates:", error);
      // Continue without duplicate checking
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Toggle contact selection
  const toggleContact = (index: number) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  };

  // Toggle all contacts
  const toggleAll = () => {
    const anySelected = contacts.some((c) => c.selected);
    setContacts((prev) => prev.map((c) => ({ ...c, selected: !anySelected })));
  };

  // Update role override
  const updateRole = (index: number, role: string) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, overrideRole: role } : c))
    );
  };

  // Import selected contacts
  const handleImport = async () => {
    const selectedContacts = contacts.filter((c) => c.selected);

    if (selectedContacts.length === 0) {
      toast.error("Please select at least one contact to import");
      return;
    }

    setIsImporting(true);
    try {
      // Transform to ContactBulkImportItem format
      const importData: ContactBulkImportItem[] = selectedContacts.map((c) => {
        const { firstName, lastName } = splitFullName(c.person.name);
        return {
          firstName,
          lastName,
          title: c.person.role, // Original role text becomes title
          email: null, // Email not extracted from transcript
          role: (c.overrideRole || "end_user") as any,
          sentiment: "unknown" as any,
          notes: `Imported from Gong transcript. Organization: ${c.person.organization}`,
          skipDuplicateCheck: false,
        };
      });

      // Bulk create contacts
      const result = await bulkCreateContacts(opportunityId, {
        contacts: importData,
      });

      // Show success message
      if (result.summary.created > 0) {
        toast.success(
          `Successfully imported ${result.summary.created} contact(s)`
        );
      }

      if (result.summary.skipped > 0) {
        toast.warning(`Skipped ${result.summary.skipped} duplicate(s)`);
      }

      if (result.summary.errors > 0) {
        toast.error(`Failed to import ${result.summary.errors} contact(s)`);
      }

      // Callback with results
      onImportComplete?.(result);
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to import contacts"
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Render helpers
  const selectedCount = contacts.filter((c) => c.selected).length;
  const allSelected = contacts.length > 0 && contacts.every((c) => c.selected);

  // Role badge color mapping
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "decision_maker":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "influencer":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "champion":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "blocker":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "end_user":
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getRoleLabel = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Empty state
  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-slate-400 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          No people found in transcript
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-slate-600" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Review Contacts to Import
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {selectedCount} of {contacts.length} selected
            </p>
          </div>
        </div>
      </div>

      {/* Duplicate check loading */}
      {isCheckingDuplicates && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking for duplicates...</span>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all contacts"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Checkbox
                    checked={contact.selected}
                    onCheckedChange={() => toggleContact(index)}
                    aria-label={`Select ${contact.person.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {contact.person.name}
                </TableCell>
                <TableCell>{contact.person.organization}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">
                  {contact.person.role}
                </TableCell>
                <TableCell>
                  <Select
                    value={contact.overrideRole}
                    onValueChange={(value) => updateRole(index, value)}
                    disabled={!contact.selected}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="decision_maker">
                        Decision Maker
                      </SelectItem>
                      <SelectItem value="influencer">Influencer</SelectItem>
                      <SelectItem value="champion">Champion</SelectItem>
                      <SelectItem value="blocker">Blocker</SelectItem>
                      <SelectItem value="end_user">End User</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {contact.isDuplicate ? (
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Possible Duplicate
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      New
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {selectedCount > 0
            ? `Ready to import ${selectedCount} contact${selectedCount !== 1 ? "s" : ""}`
            : "No contacts selected"}
        </p>
        <div className="flex gap-3">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || isImporting}
          >
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {selectedCount > 0 ? selectedCount : ""} Contact
            {selectedCount !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
