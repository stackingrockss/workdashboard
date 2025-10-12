"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import {
  Contact,
  CONTACT_ROLE_LABELS,
  CONTACT_ROLE_COLORS,
  CONTACT_SENTIMENT_COLORS,
} from "@/types/contact";
import { Badge } from "@/components/ui/badge";

interface OrgChartNodeProps {
  data: {
    contact: Contact;
    onEdit?: (contact: Contact) => void;
  };
}

function OrgChartNodeComponent({ data }: OrgChartNodeProps) {
  const { contact } = data;
  const roleColor = CONTACT_ROLE_COLORS[contact.role];
  const sentimentColor = CONTACT_SENTIMENT_COLORS[contact.sentiment];
  const roleLabel = CONTACT_ROLE_LABELS[contact.role];

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-lg shadow-lg border-2 ${roleColor} min-w-[240px] max-w-[280px]`}
      onClick={() => data.onEdit?.(contact)}
    >
      {/* Handle for incoming connections (from manager) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500"
      />

      <div className="p-4">
        {/* Avatar and Name */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {contact.firstName.charAt(0)}
            {contact.lastName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{contact.fullName}</div>
            {contact.title && (
              <div className="text-xs text-muted-foreground truncate">
                {contact.title}
              </div>
            )}
          </div>
        </div>

        {/* Role Badge */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs">
            {roleLabel}
          </Badge>
          <Badge className={`text-xs ${sentimentColor}`}>
            {contact.sentiment.charAt(0).toUpperCase() + contact.sentiment.slice(1)}
          </Badge>
        </div>

        {/* Contact Info */}
        {(contact.email || contact.phone) && (
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            {contact.email && (
              <div className="truncate" title={contact.email}>
                {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="truncate" title={contact.phone}>
                {contact.phone}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Handle for outgoing connections (to direct reports) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500"
      />
    </div>
  );
}

export const OrgChartNode = memo(OrgChartNodeComponent);
