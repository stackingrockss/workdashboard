"use client";

/**
 * ContactImportReview Component
 *
 * Displays extracted people from parsed Gong transcripts and allows users to:
 * - Review each person's details (name, organization, role)
 * - Edit name and title fields inline
 * - See AI-classified Contact role (decision_maker, influencer, etc.)
 * - Check for potential duplicate contacts
 * - Choose to skip or update existing contacts for duplicates
 * - Select which fields to update when merging with existing contacts
 * - Bulk import selected contacts to the opportunity
 */

import { useState, useEffect, useMemo } from "react";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import { splitFullName, type DuplicateMatch } from "@/lib/utils/contact-duplicate-detection";
import { bulkCreateContacts, batchCheckDuplicateContacts, type BulkImportResult } from "@/lib/api/contacts";
import { ContactBulkImportItem } from "@/lib/validations/contact";
import { ContactRole, ContactSentiment } from "@/types/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ContactImportItem {
  person: PersonExtracted;
  selected: boolean;

  // Editable fields (override AI extraction)
  editedFirstName: string;
  editedLastName: string;
  editedTitle: string;
  overrideRole: string;

  // Duplicate handling
  isDuplicate: boolean;
  duplicateMatch: DuplicateMatch | null;
  duplicateAction: "skip" | "update";

  // Per-field merge control (when duplicateAction === "update")
  fieldsToUpdate: {
    title: boolean;
    role: boolean;
  };
}

interface ContactImportReviewProps {
  people: PersonExtracted[];
  opportunityId: string;
  onImportComplete?: (result: BulkImportResult) => void;
  onCancel?: () => void;
  onDontImport?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const roleLabels: Record<string, string> = {
  decision_maker: "Decision Maker",
  influencer: "Influencer",
  champion: "Champion",
  blocker: "Blocker",
  end_user: "End User",
};

const matchTypeLabels: Record<string, string> = {
  exact_email: "Exact email match",
  exact_name: "Exact name match",
  fuzzy_name: "Similar name",
};

// ============================================================================
// Component
// ============================================================================

export function ContactImportReview({
  people,
  opportunityId,
  onImportComplete,
  onCancel,
  onDontImport,
}: ContactImportReviewProps) {
  const [contacts, setContacts] = useState<ContactImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<number>>(new Set());

  // Initialize contacts from people
  useEffect(() => {
    const initialContacts: ContactImportItem[] = people.map((person) => {
      const { firstName, lastName } = splitFullName(person.name);
      return {
        person,
        selected: true,
        editedFirstName: firstName,
        editedLastName: lastName,
        editedTitle: person.role || "",
        overrideRole: person.classifiedRole || "end_user",
        isDuplicate: false,
        duplicateMatch: null,
        duplicateAction: "skip", // Default, will be updated after duplicate check
        fieldsToUpdate: {
          title: true,
          role: true,
        },
      };
    });
    setContacts(initialContacts);

    // Check for duplicates
    checkForDuplicates(initialContacts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  // Check for duplicates using batch API
  const checkForDuplicates = async (contactList: ContactImportItem[]) => {
    setIsCheckingDuplicates(true);
    try {
      const contactsToCheck = contactList.map((item) => ({
        firstName: item.editedFirstName,
        lastName: item.editedLastName,
        email: null,
      }));

      const batchResult = await batchCheckDuplicateContacts(opportunityId, {
        contacts: contactsToCheck,
      });

      const updatedContacts: ContactImportItem[] = contactList.map((contact, index) => {
        const duplicateCheck = batchResult.results[index];
        if (duplicateCheck && duplicateCheck.isDuplicate && duplicateCheck.matches.length > 0) {
          const match = duplicateCheck.matches[0];
          // Set default action based on confidence
          const defaultAction: "skip" | "update" = match.confidence === "high" ? "update" : "skip";
          return {
            ...contact,
            isDuplicate: true,
            duplicateMatch: match,
            duplicateAction: defaultAction,
          };
        }
        return contact;
      });

      setContacts(updatedContacts);

      // Auto-expand first duplicate for visibility
      const firstDuplicateIndex = updatedContacts.findIndex((c) => c.isDuplicate);
      if (firstDuplicateIndex >= 0) {
        setExpandedDuplicates(new Set([firstDuplicateIndex]));
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
      toast.warning("Could not check for duplicates - proceeding with import");
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Separate contacts into duplicates and non-duplicates
  const { regularContacts, duplicateContacts } = useMemo(() => {
    const regular: { contact: ContactImportItem; index: number }[] = [];
    const duplicates: { contact: ContactImportItem; index: number }[] = [];

    contacts.forEach((contact, index) => {
      if (contact.isDuplicate) {
        duplicates.push({ contact, index });
      } else {
        regular.push({ contact, index });
      }
    });

    return { regularContacts: regular, duplicateContacts: duplicates };
  }, [contacts]);

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

  // Update editable field
  const updateField = (index: number, field: keyof ContactImportItem, value: string | boolean) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  // Update duplicate action
  const updateDuplicateAction = (index: number, action: "skip" | "update") => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, duplicateAction: action } : c))
    );
  };

  // Toggle field to update
  const toggleFieldToUpdate = (index: number, field: "title" | "role") => {
    setContacts((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              fieldsToUpdate: {
                ...c.fieldsToUpdate,
                [field]: !c.fieldsToUpdate[field],
              },
            }
          : c
      )
    );
  };

  // Toggle duplicate expansion
  const toggleDuplicateExpanded = (index: number) => {
    setExpandedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Import selected contacts
  const handleImport = async () => {
    // Filter: selected contacts that are either not duplicates OR duplicates with "update" action
    const contactsToImport = contacts.filter(
      (c) => c.selected && (!c.isDuplicate || c.duplicateAction === "update")
    );

    if (contactsToImport.length === 0) {
      toast.error("No contacts to import. Select contacts or choose 'Update existing' for duplicates.");
      return;
    }

    // Validate that all contacts have first names
    const invalidContacts = contactsToImport.filter((c) => !c.editedFirstName.trim());
    if (invalidContacts.length > 0) {
      toast.error("All contacts must have a first name");
      return;
    }

    setIsImporting(true);
    try {
      const importData: ContactBulkImportItem[] = contactsToImport.map((c) => ({
        firstName: c.editedFirstName.trim(),
        lastName: c.editedLastName.trim() || "Unknown",
        title: c.editedTitle.trim() || null,
        email: null,
        role: (c.overrideRole || "end_user") as ContactRole,
        sentiment: "unknown" as ContactSentiment,
        notes: `Imported from Gong transcript. Organization: ${c.person.organization}`,
        skipDuplicateCheck: c.isDuplicate && c.duplicateAction === "update", // Skip check if we're merging
        mergeWithExistingId: c.isDuplicate && c.duplicateAction === "update" && c.duplicateMatch
          ? c.duplicateMatch.contactId
          : null,
        fieldsToMerge: c.isDuplicate && c.duplicateAction === "update"
          ? c.fieldsToUpdate
          : undefined,
      }));

      const result = await bulkCreateContacts(opportunityId, {
        contacts: importData,
      });

      // Show success message
      if (result.summary.created > 0) {
        const updatedCount = contactsToImport.filter(
          (c) => c.isDuplicate && c.duplicateAction === "update"
        ).length;
        const createdCount = result.summary.created - updatedCount;

        if (createdCount > 0 && updatedCount > 0) {
          toast.success(`Created ${createdCount} and updated ${updatedCount} contact(s)`);
        } else if (updatedCount > 0) {
          toast.success(`Updated ${updatedCount} existing contact(s)`);
        } else {
          toast.success(`Successfully imported ${createdCount} contact(s)`);
        }
      }

      if (result.summary.skipped > 0) {
        toast.warning(`Skipped ${result.summary.skipped} duplicate(s)`);
      }

      if (result.summary.errors > 0) {
        toast.error(`Failed to import ${result.summary.errors} contact(s)`);
      }

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
  const importableCount = contacts.filter(
    (c) => c.selected && (!c.isDuplicate || c.duplicateAction === "update")
  ).length;
  const allSelected = contacts.length > 0 && contacts.every((c) => c.selected);

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
              {selectedCount} selected, {importableCount} will be imported
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

      {/* Mobile Card View - All contacts as cards */}
      <div className="space-y-3 md:hidden">
        {/* Select All Header */}
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all contacts"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Select all
          </span>
        </div>

        {/* Contact Cards */}
        {contacts.map((contact, index) => (
          <MobileContactCard
            key={index}
            contact={contact}
            index={index}
            onToggleSelect={toggleContact}
            onUpdateField={updateField}
            onUpdateDuplicateAction={updateDuplicateAction}
            onToggleFieldToUpdate={toggleFieldToUpdate}
          />
        ))}
      </div>

      {/* Desktop View - Table for regular contacts, cards for duplicates */}
      <div className="hidden md:block space-y-4">
        {/* Regular contacts table */}
        {regularContacts.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
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
                    <TableHead className="min-w-[180px]">Name</TableHead>
                    <TableHead className="min-w-[120px]">Organization</TableHead>
                    <TableHead className="min-w-[150px]">Title</TableHead>
                    <TableHead className="min-w-[140px]">Role</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularContacts.map(({ contact, index }) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={contact.selected}
                          onCheckedChange={() => toggleContact(index)}
                          aria-label={`Select ${contact.editedFirstName} ${contact.editedLastName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Input
                            value={contact.editedFirstName}
                            onChange={(e) => updateField(index, "editedFirstName", e.target.value)}
                            placeholder="First"
                            className="h-8 text-sm w-[80px]"
                          />
                          <Input
                            value={contact.editedLastName}
                            onChange={(e) => updateField(index, "editedLastName", e.target.value)}
                            placeholder="Last"
                            className="h-8 text-sm w-[80px]"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {contact.person.organization || "-"}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={contact.editedTitle}
                          onChange={(e) => updateField(index, "editedTitle", e.target.value)}
                          placeholder="Title"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={contact.overrideRole}
                          onValueChange={(value) => updateField(index, "overrideRole", value)}
                          disabled={!contact.selected}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="decision_maker">Decision Maker</SelectItem>
                            <SelectItem value="influencer">Influencer</SelectItem>
                            <SelectItem value="champion">Champion</SelectItem>
                            <SelectItem value="blocker">Blocker</SelectItem>
                            <SelectItem value="end_user">End User</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          New
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Duplicate contacts - expanded cards */}
        {duplicateContacts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Potential Duplicates ({duplicateContacts.length})
            </h4>
            {duplicateContacts.map(({ contact, index }) => (
              <DuplicateContactCard
                key={index}
                contact={contact}
                index={index}
                isExpanded={expandedDuplicates.has(index)}
                onToggleExpand={toggleDuplicateExpanded}
                onToggleSelect={toggleContact}
                onUpdateField={updateField}
                onUpdateDuplicateAction={updateDuplicateAction}
                onToggleFieldToUpdate={toggleFieldToUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {importableCount > 0
            ? `Ready to import ${importableCount} contact${importableCount !== 1 ? "s" : ""}`
            : "No contacts to import"}
        </p>
        <div className="flex gap-3">
          {onDontImport && (
            <Button
              variant="ghost"
              onClick={onDontImport}
              disabled={isImporting}
              className="text-muted-foreground"
            >
              Don&apos;t Import
            </Button>
          )}
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleImport}
            disabled={importableCount === 0 || isImporting}
            className="flex-1 sm:flex-none"
          >
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {importableCount > 0 ? importableCount : ""} Contact
            {importableCount !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface DuplicateContactCardProps {
  contact: ContactImportItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (index: number) => void;
  onToggleSelect: (index: number) => void;
  onUpdateField: (index: number, field: keyof ContactImportItem, value: string | boolean) => void;
  onUpdateDuplicateAction: (index: number, action: "skip" | "update") => void;
  onToggleFieldToUpdate: (index: number, field: "title" | "role") => void;
}

function DuplicateContactCard({
  contact,
  index,
  isExpanded,
  onToggleExpand,
  onToggleSelect,
  onUpdateField,
  onUpdateDuplicateAction,
  onToggleFieldToUpdate,
}: DuplicateContactCardProps) {
  const match = contact.duplicateMatch;

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        contact.selected ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20" : "border-slate-200"
      }`}
    >
      {/* Header - always visible */}
      <div className="flex items-center gap-3 p-3">
        <Checkbox
          checked={contact.selected}
          onCheckedChange={() => onToggleSelect(index)}
          aria-label={`Select ${contact.editedFirstName} ${contact.editedLastName}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {contact.editedFirstName} {contact.editedLastName}
            </span>
            <Badge
              variant="outline"
              className={
                contact.duplicateAction === "skip"
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs"
              }
            >
              {contact.duplicateAction === "skip" ? "Skip" : "Update"}
            </Badge>
          </div>
          {contact.person.organization && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {contact.person.organization}
            </p>
          )}
        </div>
        <button
          onClick={() => onToggleExpand(index)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          {isExpanded ? "Collapse" : "Edit details"}
        </button>
        <button
          onClick={() => onToggleExpand(index)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4 bg-white dark:bg-slate-900">
          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-500">First Name</Label>
              <Input
                value={contact.editedFirstName}
                onChange={(e) => onUpdateField(index, "editedFirstName", e.target.value)}
                placeholder="First name"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Last Name</Label>
              <Input
                value={contact.editedLastName}
                onChange={(e) => onUpdateField(index, "editedLastName", e.target.value)}
                placeholder="Last name"
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-500">Title</Label>
            <Input
              value={contact.editedTitle}
              onChange={(e) => onUpdateField(index, "editedTitle", e.target.value)}
              placeholder="Job title"
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-500">Role</Label>
            <Select
              value={contact.overrideRole}
              onValueChange={(value) => onUpdateField(index, "overrideRole", value)}
            >
              <SelectTrigger className="h-8 text-sm mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decision_maker">Decision Maker</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
                <SelectItem value="blocker">Blocker</SelectItem>
                <SelectItem value="end_user">End User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Match info */}
          {match && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-md p-3 text-sm">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Matches existing contact:
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                {match.firstName} {match.lastName}
                {match.title && ` • ${match.title}`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                {matchTypeLabels[match.matchType]} ({match.confidence} confidence)
              </p>
            </div>
          )}

          {/* Action selection */}
          <div className="space-y-3">
            <Label className="text-xs text-slate-500">What would you like to do?</Label>
            <RadioGroup
              value={contact.duplicateAction}
              onValueChange={(value) => onUpdateDuplicateAction(index, value as "skip" | "update")}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="skip" id={`skip-${index}`} />
                <Label htmlFor={`skip-${index}`} className="text-sm font-normal cursor-pointer">
                  Skip - don&apos;t import this contact
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="update" id={`update-${index}`} />
                <Label htmlFor={`update-${index}`} className="text-sm font-normal cursor-pointer">
                  Update existing contact with new information
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Field selection for update */}
          {contact.duplicateAction === "update" && match && (
            <div className="space-y-2 pl-6 border-l-2 border-blue-200 dark:border-blue-800">
              <Label className="text-xs text-slate-500">Fields to update:</Label>

              {/* Title field */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`title-${index}`}
                  checked={contact.fieldsToUpdate.title}
                  onCheckedChange={() => onToggleFieldToUpdate(index, "title")}
                />
                <div className="flex-1">
                  <Label htmlFor={`title-${index}`} className="text-sm font-normal cursor-pointer">
                    Title
                  </Label>
                  <p className="text-xs text-slate-500">
                    {contact.editedTitle || "(empty)"} → {match.title || "(empty)"}
                  </p>
                </div>
              </div>

              {/* Role field */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`role-${index}`}
                  checked={contact.fieldsToUpdate.role}
                  onCheckedChange={() => onToggleFieldToUpdate(index, "role")}
                />
                <div className="flex-1">
                  <Label htmlFor={`role-${index}`} className="text-sm font-normal cursor-pointer">
                    Role
                  </Label>
                  <p className="text-xs text-slate-500">
                    {roleLabels[contact.overrideRole] || contact.overrideRole} → (current role in system)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MobileContactCardProps {
  contact: ContactImportItem;
  index: number;
  onToggleSelect: (index: number) => void;
  onUpdateField: (index: number, field: keyof ContactImportItem, value: string | boolean) => void;
  onUpdateDuplicateAction: (index: number, action: "skip" | "update") => void;
  onToggleFieldToUpdate: (index: number, field: "title" | "role") => void;
}

function MobileContactCard({
  contact,
  index,
  onToggleSelect,
  onUpdateField,
  onUpdateDuplicateAction,
  onToggleFieldToUpdate,
}: MobileContactCardProps) {
  const [isExpanded, setIsExpanded] = useState(contact.isDuplicate);
  const match = contact.duplicateMatch;

  return (
    <div
      className={`border rounded-lg p-3 space-y-3 ${
        contact.selected
          ? contact.isDuplicate
            ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20"
            : "border-primary/50 bg-primary/5"
          : ""
      }`}
    >
      {/* Header Row: Checkbox + Name + Status */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={contact.selected}
          onCheckedChange={() => onToggleSelect(index)}
          aria-label={`Select ${contact.editedFirstName} ${contact.editedLastName}`}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-medium text-sm truncate text-left hover:underline"
            >
              {contact.editedFirstName} {contact.editedLastName}
            </button>
            {contact.isDuplicate ? (
              <Badge
                variant="outline"
                className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs shrink-0"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {contact.duplicateAction === "skip" ? "Skip" : "Update"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs shrink-0"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                New
              </Badge>
            )}
          </div>
          {contact.person.organization && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {contact.person.organization}
            </p>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3 pl-7">
          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-slate-500">First Name</Label>
              <Input
                value={contact.editedFirstName}
                onChange={(e) => onUpdateField(index, "editedFirstName", e.target.value)}
                placeholder="First"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Last Name</Label>
              <Input
                value={contact.editedLastName}
                onChange={(e) => onUpdateField(index, "editedLastName", e.target.value)}
                placeholder="Last"
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-500">Title</Label>
            <Input
              value={contact.editedTitle}
              onChange={(e) => onUpdateField(index, "editedTitle", e.target.value)}
              placeholder="Job title"
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-500">Role</Label>
            <Select
              value={contact.overrideRole}
              onValueChange={(value) => onUpdateField(index, "overrideRole", value)}
              disabled={!contact.selected}
            >
              <SelectTrigger className="w-full h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decision_maker">Decision Maker</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
                <SelectItem value="blocker">Blocker</SelectItem>
                <SelectItem value="end_user">End User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duplicate handling for mobile */}
          {contact.isDuplicate && match && (
            <>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-md p-3 text-sm">
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  Matches: {match.firstName} {match.lastName}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {matchTypeLabels[match.matchType]}
                </p>
              </div>

              <RadioGroup
                value={contact.duplicateAction}
                onValueChange={(value) => onUpdateDuplicateAction(index, value as "skip" | "update")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id={`m-skip-${index}`} />
                  <Label htmlFor={`m-skip-${index}`} className="text-xs font-normal">
                    Skip import
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id={`m-update-${index}`} />
                  <Label htmlFor={`m-update-${index}`} className="text-xs font-normal">
                    Update existing
                  </Label>
                </div>
              </RadioGroup>

              {contact.duplicateAction === "update" && (
                <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`m-title-${index}`}
                      checked={contact.fieldsToUpdate.title}
                      onCheckedChange={() => onToggleFieldToUpdate(index, "title")}
                    />
                    <Label htmlFor={`m-title-${index}`} className="text-xs">
                      Update title
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`m-role-${index}`}
                      checked={contact.fieldsToUpdate.role}
                      onCheckedChange={() => onToggleFieldToUpdate(index, "role")}
                    />
                    <Label htmlFor={`m-role-${index}`} className="text-xs">
                      Update role
                    </Label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Expand/collapse for non-duplicates */}
      {!contact.isDuplicate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 dark:text-blue-400 pl-7 hover:underline"
        >
          {isExpanded ? "Collapse" : "Edit details"}
        </button>
      )}
    </div>
  );
}
