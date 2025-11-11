"use client";

import { useState } from "react";
import { Contact } from "@/types/contact";
import { ContactCard } from "@/components/contacts/ContactCard";
import { Button } from "@/components/ui/button";
import { Plus, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactForm } from "@/components/forms/contact-form";
import { ContactCreateInput, ContactUpdateInput } from "@/lib/validations/contact";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface DecisionMakerSectionProps {
  contacts: Contact[];
  opportunityId: string;
  apiEndpoint: string;
  onContactsUpdate?: (contacts: Contact[]) => void;
}

export function DecisionMakerSection({
  contacts,
  apiEndpoint,
  onContactsUpdate,
}: DecisionMakerSectionProps) {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter for decision makers only
  const decisionMakers = contacts.filter((c) => c.role === "decision_maker");

  // Create contact with decision_maker role
  const handleCreateContact = async (data: ContactCreateInput | ContactUpdateInput) => {
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create contact");
      }

      const newContact = await response.json();
      const updatedContacts = [...contacts, newContact];
      onContactsUpdate?.(updatedContacts);
      setIsCreateDialogOpen(false);
      toast.success("Decision maker added successfully!");
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
      const response = await fetch(`${apiEndpoint}/${selectedContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update contact");
      }

      const updatedContact = await response.json();
      const updatedContacts = contacts.map((c) =>
        c.id === updatedContact.id ? updatedContact : c
      );
      onContactsUpdate?.(updatedContacts);
      setIsEditDialogOpen(false);
      setSelectedContact(null);
      toast.success("Decision maker updated successfully!");
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
      const response = await fetch(`${apiEndpoint}/${selectedContact.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }

      const updatedContacts = contacts.filter((c) => c.id !== selectedContact.id);
      onContactsUpdate?.(updatedContacts);
      setIsDeleteDialogOpen(false);
      setSelectedContact(null);
      toast.success("Decision maker removed successfully!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete contact"
      );
    } finally {
      setIsDeleting(false);
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
    <div className="space-y-3">
      {/* Empty State */}
      {decisionMakers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/20">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-medium text-sm mb-1">No decision makers identified yet</h4>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
            Add contacts with decision-making authority for this opportunity
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Decision Maker Contact
          </Button>
        </div>
      ) : (
        <>
          {/* Decision Makers Grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {decisionMakers.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>

          {/* Add Another Button */}
          <Button
            variant="outline"
            onClick={() => setIsCreateDialogOpen(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Decision Maker
          </Button>
        </>
      )}

      {/* Create Contact Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Decision Maker</DialogTitle>
          </DialogHeader>
          <ContactForm
            onSubmit={handleCreateContact}
            onCancel={() => setIsCreateDialogOpen(false)}
            existingContacts={contacts}
            initialData={{
              role: "decision_maker", // Pre-select decision_maker role
            }}
            submitLabel="Add Decision Maker"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Decision Maker</DialogTitle>
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
              submitLabel="Update Decision Maker"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Decision Maker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove &quot;{selectedContact?.fullName}&quot; as a
              decision maker? This will delete the contact from this opportunity.
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
                {isDeleting ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
