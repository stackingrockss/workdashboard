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

interface ContactListProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export function ContactList({ contacts, onEdit, onDelete }: ContactListProps) {
  const [roleFilter, setRoleFilter] = useState<ContactRole | "all">("all");
  const [sentimentFilter, setSentimentFilter] = useState<ContactSentiment | "all">("all");

  // Apply filters
  const filteredContacts = contacts.filter((contact) => {
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

        <div className="text-sm text-muted-foreground">
          Showing {filteredContacts.length} of {contacts.length} contacts
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
