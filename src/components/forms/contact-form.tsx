"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContactCreateInput,
  ContactUpdateInput,
} from "@/lib/validations/contact";
import { Contact, CONTACT_ROLE_LABELS, CONTACT_SENTIMENT_LABELS } from "@/types/contact";

interface ContactFormProps {
  onSubmit: (data: ContactCreateInput | ContactUpdateInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ContactCreateInput>;
  existingContacts?: Contact[]; // For manager selection
  submitLabel?: string;
}

export function ContactForm({
  onSubmit,
  onCancel,
  initialData,
  existingContacts = [],
  submitLabel = "Create Contact",
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<ContactCreateInput>>({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    title: initialData?.title || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    role: initialData?.role || "end_user",
    sentiment: initialData?.sentiment || "unknown",
    managerId: initialData?.managerId || undefined,
    notes: initialData?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Clean up empty strings to null
      const cleanedData = {
        ...formData,
        title: formData.title || null,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
        managerId: formData.managerId || null,
      };

      await onSubmit(cleanedData as ContactCreateInput);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            First Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            required
            placeholder="John"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">
            Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            required
            placeholder="Smith"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Job Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="VP of Engineering"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="john.smith@company.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">
            Role <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.role}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                role: value as ContactCreateInput["role"],
              })
            }
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sentiment">
            Sentiment <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.sentiment}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                sentiment: value as ContactCreateInput["sentiment"],
              })
            }
          >
            <SelectTrigger id="sentiment">
              <SelectValue placeholder="Select sentiment" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONTACT_SENTIMENT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {existingContacts.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="managerId">Reports To</Label>
          <Select
            value={formData.managerId || "none"}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                managerId: value === "none" ? undefined : value,
              })
            }
          >
            <SelectTrigger id="managerId">
              <SelectValue placeholder="Select manager (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No manager</SelectItem>
              {existingContacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.fullName} {contact.title && `- ${contact.title}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about this contact..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
