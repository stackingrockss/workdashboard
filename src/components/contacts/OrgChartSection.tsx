"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Contact } from "@/types/contact";
import { ContactCreateInput, ContactUpdateInput } from "@/lib/validations/contact";
import { ContactForm } from "@/components/forms/ContactForm";
import { ContactList } from "./ContactList";
import { OrgChartView } from "./OrgChartView";
import { PendingContactsSection } from "./PendingContactsSection";
import { Plus, List, Network } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface OrgChartSectionProps {
  opportunityId?: string;
  parentId?: string;
  parentType?: "opportunity" | "account";
  apiEndpoint?: string;
  initialContacts?: Contact[];
}

type ViewMode = "list" | "chart";

export function OrgChartSection({
  opportunityId,
  parentId,
  parentType,
  apiEndpoint,
  initialContacts = [],
}: OrgChartSectionProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

  // Determine the API endpoint based on props
  const effectiveApiEndpoint = apiEndpoint ||
    (opportunityId ? `/api/v1/opportunities/${opportunityId}/contacts` :
     parentId ? `/api/v1/${parentType === "account" ? "accounts" : "opportunities"}/${parentId}/contacts` :
     "");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(effectiveApiEndpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      const data = await response.json();
      // API returns { contacts: [...] } - extract the array, with fallback for safety
      const contactsArray = Array.isArray(data) ? data : (Array.isArray(data?.contacts) ? data.contacts : []);
      setContacts(contactsArray);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load contacts"
      );
    } finally {
      setIsLoading(false);
    }
  }, [effectiveApiEndpoint]);

  // Load contacts
  useEffect(() => {
    if (effectiveApiEndpoint) {
      loadContacts();
    }
  }, [effectiveApiEndpoint, loadContacts]);

  // Create contact
  const handleCreateContact = async (data: ContactCreateInput | ContactUpdateInput) => {
    try {
      const response = await fetch(effectiveApiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create contact");
      }

      const newContact = await response.json();
      setContacts([...contacts, newContact]);
      setIsCreateDialogOpen(false);
      toast.success("Contact created successfully!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create contact"
      );
      throw error;
    }
  };

  // Update contact
  const handleUpdateContact = async (data: ContactCreateInput | ContactUpdateInput) => {
    if (!selectedContact) return;

    try {
      const response = await fetch(`${effectiveApiEndpoint}/${selectedContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update contact");
      }

      const updatedContact = await response.json();
      setContacts(
        contacts.map((c) => (c.id === updatedContact.id ? updatedContact : c))
      );
      setIsEditDialogOpen(false);
      setSelectedContact(null);
      toast.success("Contact updated successfully!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update contact"
      );
      throw error;
    }
  };

  // Delete contact
  const handleDeleteContact = async () => {
    if (!selectedContact) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${effectiveApiEndpoint}/${selectedContact.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }

      setContacts(contacts.filter((c) => c.id !== selectedContact.id));
      setIsDeleteDialogOpen(false);
      setSelectedContact(null);
      toast.success("Contact deleted successfully!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete contact"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle position change from drag-and-drop
  const handlePositionChange = async (
    contactId: string,
    x: number,
    y: number
  ) => {
    try {
      const response = await fetch(`${effectiveApiEndpoint}/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionX: x, positionY: y }),
      });

      if (!response.ok) {
        throw new Error("Failed to update position");
      }

      // Update local state
      setContacts(
        contacts.map((c) =>
          c.id === contactId ? { ...c, positionX: x, positionY: y } : c
        )
      );
    } catch (error) {
      // Silent error - position updates are non-critical
      console.error("Failed to save position:", error);
    }
  };

  // Open edit dialog
  const handleEditClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const handleDeleteClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Pending Contact Imports */}
      {opportunityId && (
        <PendingContactsSection
          opportunityId={opportunityId}
          onImportComplete={loadContacts}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Organization Chart</h2>
          <p className="text-sm text-muted-foreground">
            Map out stakeholders and their relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-r-none"
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
            <Button
              variant={viewMode === "chart" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("chart")}
              className="rounded-l-none"
            >
              <Network className="h-4 w-4 mr-1" />
              Chart
            </Button>
          </div>

          {/* Add Contact Button */}
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading contacts...</div>
        </div>
      ) : viewMode === "list" ? (
        <ContactList
          contacts={contacts}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      ) : (
        <OrgChartView
          contacts={contacts}
          onContactClick={handleEditClick}
          onPositionChange={handlePositionChange}
        />
      )}

      {/* Create Contact Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            onSubmit={handleCreateContact}
            onCancel={() => setIsCreateDialogOpen(false)}
            existingContacts={contacts}
            submitLabel="Create Contact"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <ContactForm
              onSubmit={handleUpdateContact}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedContact(null);
              }}
              existingContacts={contacts.filter((c) => c.id !== selectedContact.id)}
              initialData={{
                firstName: selectedContact.firstName,
                lastName: selectedContact.lastName,
                title: selectedContact.title,
                email: selectedContact.email,
                phone: selectedContact.phone,
                role: selectedContact.role,
                sentiment: selectedContact.sentiment,
                managerId: selectedContact.managerId,
                notes: selectedContact.notes,
              }}
              submitLabel="Update Contact"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{selectedContact?.fullName}&quot;?
              This action cannot be undone.
              {selectedContact?.directReports && selectedContact.directReports.length > 0 && (
                <span className="block mt-2 text-orange-600 dark:text-orange-400">
                  Note: This contact has {selectedContact.directReports.length} direct
                  report(s). They will no longer have a manager assigned.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setSelectedContact(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteContact}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
