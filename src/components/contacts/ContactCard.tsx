"use client";

import {
  Contact,
  ContactRole,
  CONTACT_ROLE_LABELS,
  CONTACT_SENTIMENT_COLORS,
  SENIORITY_LABELS,
  SENIORITY_COLORS,
} from "@/types/contact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Phone,
  Pencil,
  Trash2,
  User,
  Linkedin,
  Building2,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onEnrich?: (contact: Contact) => void;
  onUpdateRole?: (contact: Contact, role: ContactRole) => void;
  isEnriching?: boolean;
}

const ROLE_OPTIONS: ContactRole[] = [
  "decision_maker",
  "influencer",
  "champion",
  "blocker",
  "end_user",
];

export function ContactCard({ contact, onEdit, onDelete, onEnrich, onUpdateRole, isEnriching }: ContactCardProps) {
  const sentimentColorClass = CONTACT_SENTIMENT_COLORS[contact.sentiment];
  const roleLabel = CONTACT_ROLE_LABELS[contact.role];
  const seniorityLabel = contact.seniority
    ? SENIORITY_LABELS[contact.seniority] || contact.seniority
    : null;
  const seniorityColor = contact.seniority
    ? SENIORITY_COLORS[contact.seniority] || "bg-gray-100 text-gray-800"
    : null;

  const initials = `${contact.firstName.charAt(0)}${contact.lastName.charAt(0)}`;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar - with image support */}
          {contact.avatarUrl ? (
            <img
              src={contact.avatarUrl}
              alt={contact.fullName}
              className="flex-shrink-0 w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                // Fallback to initials on image load error
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg ${contact.avatarUrl ? "hidden" : ""}`}
          >
            {initials}
          </div>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base truncate">
                    {contact.fullName}
                  </h3>
                  {/* LinkedIn Link */}
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                      title="View LinkedIn Profile"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                </div>
                {contact.title && (
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.title}
                  </p>
                )}
                {/* Company from enrichment */}
                {contact.company && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{contact.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Role, Sentiment, and Seniority Badges */}
            <div className="flex flex-wrap gap-2 mt-2">
              {onUpdateRole ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-accent flex items-center gap-1"
                    >
                      {roleLabel}
                      <ChevronDown className="h-3 w-3" />
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ROLE_OPTIONS.map((role) => (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => onUpdateRole(contact, role)}
                        className={contact.role === role ? "bg-accent" : ""}
                      >
                        {CONTACT_ROLE_LABELS[role]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {roleLabel}
                </Badge>
              )}
              {contact.sentiment !== "unknown" && (
                <Badge className={`text-xs ${sentimentColorClass}`}>
                  {contact.sentiment.charAt(0).toUpperCase() +
                    contact.sentiment.slice(1)}
                </Badge>
              )}
              {seniorityLabel && seniorityColor && (
                <Badge className={`text-xs ${seniorityColor}`}>
                  {seniorityLabel}
                </Badge>
              )}
            </div>

            {/* Contact Details */}
            <div className="flex flex-col gap-1 mt-3">
              {contact.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:underline truncate"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <a
                    href={`tel:${contact.phone}`}
                    className="hover:underline truncate"
                  >
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.manager && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    Reports to: {contact.manager.firstName}{" "}
                    {contact.manager.lastName}
                  </span>
                </div>
              )}
            </div>

            {/* Bio from enrichment */}
            {contact.bio && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2 italic">
                {contact.bio}
              </p>
            )}

            {/* Notes - strip import metadata */}
            {(() => {
              const cleanedNotes = contact.notes
                ?.replace(/^Imported from Gong transcript\. Organization: .+$/m, "")
                .replace(/^Imported from calendar event attendees$/m, "")
                .trim();
              return cleanedNotes ? (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {cleanedNotes}
                </p>
              ) : null;
            })()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          {/* Enrich button - only show for unenriched contacts with email */}
          {onEnrich && contact.email && (!contact.enrichmentStatus || contact.enrichmentStatus === "none" || contact.enrichmentStatus === "failed") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEnrich(contact)}
              disabled={isEnriching}
              className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              title="Enrich contact data"
            >
              {isEnriching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(contact)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(contact)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
