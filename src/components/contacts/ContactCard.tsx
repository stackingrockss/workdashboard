"use client";

import { Contact, CONTACT_ROLE_LABELS, CONTACT_SENTIMENT_COLORS } from "@/types/contact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Phone, Pencil, Trash2, User } from "lucide-react";

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const sentimentColorClass = CONTACT_SENTIMENT_COLORS[contact.sentiment];
  const roleLabel = CONTACT_ROLE_LABELS[contact.role];

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
            {contact.firstName.charAt(0)}
            {contact.lastName.charAt(0)}
          </div>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base truncate">
                  {contact.fullName}
                </h3>
                {contact.title && (
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.title}
                  </p>
                )}
              </div>
            </div>

            {/* Role and Sentiment Badges */}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {roleLabel}
              </Badge>
              <Badge className={`text-xs ${sentimentColorClass}`}>
                {contact.sentiment.charAt(0).toUpperCase() + contact.sentiment.slice(1)}
              </Badge>
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
                    Reports to: {contact.manager.firstName} {contact.manager.lastName}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            {contact.notes && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {contact.notes}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
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
