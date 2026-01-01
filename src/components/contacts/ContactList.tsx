"use client";

import { Contact, ContactRole, ContactSentiment } from "@/types/contact";
import { ContactCard } from "./ContactCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ContactListProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  opportunityId?: string;
  onContactsUpdated?: () => void;
}

export function ContactList({ contacts, onEdit, onDelete, opportunityId, onContactsUpdated }: ContactListProps) {
  const [roleFilter, setRoleFilter] = useState<ContactRole | "all">("all");
  const [sentimentFilter, setSentimentFilter] = useState<ContactSentiment | "all">("all");
  const [enrichingContactId, setEnrichingContactId] = useState<string | null>(null);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);

  // Defensive check - ensure contacts is an array
  const safeContacts = Array.isArray(contacts) ? contacts : [];

  // Apply filters
  const filteredContacts = safeContacts.filter((contact) => {
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;
    const matchesSentiment =
      sentimentFilter === "all" || contact.sentiment === sentimentFilter;
    return matchesRole && matchesSentiment;
  });

  // Group contacts by role for better organization
  const groupedContacts = filteredContacts.reduce(
    (acc, contact) => {
      if (!acc[contact.role]) {
        acc[contact.role] = [];
      }
      acc[contact.role].push(contact);
      return acc;
    },
    {} as Record<ContactRole, Contact[]>
  );

  const hasFilters = roleFilter !== "all" || sentimentFilter !== "all";

  // Count unenriched contacts with emails
  const unenrichedCount = safeContacts.filter(
    (c) => c.email && (!c.enrichmentStatus || c.enrichmentStatus === "none" || c.enrichmentStatus === "failed")
  ).length;

  // Handle single contact enrichment
  const handleEnrichContact = async (contact: Contact) => {
    if (!opportunityId || !contact.email) return;

    setEnrichingContactId(contact.id);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/contacts/${contact.id}/enrich`,
        { method: "POST" }
      );

      const data = await response.json();

      if (response.ok && data.enriched) {
        toast.success(`Enriched ${contact.fullName}`);
        onContactsUpdated?.();
      } else if (data.error === "Person not found") {
        toast.info(`No data found for ${contact.email}`);
        onContactsUpdated?.();
      } else {
        toast.error(data.error || "Failed to enrich contact");
      }
    } catch (error) {
      console.error("Failed to enrich contact:", error);
      toast.error("Failed to enrich contact");
    } finally {
      setEnrichingContactId(null);
    }
  };

  // Handle bulk enrichment
  const handleBulkEnrich = async () => {
    if (!opportunityId) return;

    setIsBulkEnriching(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/contacts/enrich`,
        { method: "POST" }
      );

      const data = await response.json();

      if (response.ok) {
        if (data.enriched > 0) {
          toast.success(`Enriched ${data.enriched} contacts`);
        } else if (data.processed === 0) {
          toast.info("No contacts to enrich");
        } else {
          toast.info(`Processed ${data.processed} contacts, ${data.skipped} not found`);
        }
        onContactsUpdated?.();
      } else {
        toast.error(data.error || "Failed to enrich contacts");
      }
    } catch (error) {
      console.error("Failed to bulk enrich contacts:", error);
      toast.error("Failed to enrich contacts");
    } finally {
      setIsBulkEnriching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Role:</label>
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as ContactRole | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="decision_maker">Decision Maker</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
                <SelectItem value="blocker">Blocker</SelectItem>
                <SelectItem value="end_user">End User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sentiment:</label>
            <Select
              value={sentimentFilter}
              onValueChange={(value) =>
                setSentimentFilter(value as ContactSentiment | "all")
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="advocate">Advocate</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRoleFilter("all");
                setSentimentFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk Enrich Button */}
          {opportunityId && unenrichedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkEnrich}
              disabled={isBulkEnriching}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              {isBulkEnriching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Enrich {unenrichedCount} contact{unenrichedCount !== 1 ? "s" : ""}
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            Showing {filteredContacts.length} of {contacts.length} contacts
          </div>
        </div>
      </div>

      {/* Contact List */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {contacts.length === 0
            ? "No contacts yet. Add your first contact to build the org chart."
            : "No contacts match the selected filters."}
        </div>
      ) : (
        <div className="grid gap-4">
          {Object.entries(groupedContacts).map(([role, roleContacts]) => (
            <div key={role} className="space-y-3">
              {roleFilter === "all" && (
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {role.replace("_", " ")}s ({roleContacts.length})
                </h3>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {roleContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onEnrich={opportunityId ? handleEnrichContact : undefined}
                    isEnriching={enrichingContactId === contact.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
