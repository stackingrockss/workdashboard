import { Contact } from "@/types/contact";
import {
  ContactCreateInput,
  ContactUpdateInput,
} from "@/lib/validations/contact";

const API_BASE = "/api/v1";

/**
 * Fetch all contacts for a specific opportunity
 */
export async function fetchContacts(opportunityId: string): Promise<Contact[]> {
  const response = await fetch(
    `${API_BASE}/opportunities/${opportunityId}/contacts`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch contacts");
  }

  return response.json();
}

/**
 * Fetch a single contact
 */
export async function fetchContact(
  opportunityId: string,
  contactId: string
): Promise<Contact> {
  const response = await fetch(
    `${API_BASE}/opportunities/${opportunityId}/contacts/${contactId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch contact");
  }

  return response.json();
}

/**
 * Create a new contact for an opportunity
 */
export async function createContact(
  opportunityId: string,
  data: ContactCreateInput
): Promise<Contact> {
  const response = await fetch(
    `${API_BASE}/opportunities/${opportunityId}/contacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create contact");
  }

  return response.json();
}

/**
 * Update an existing contact
 */
export async function updateContact(
  opportunityId: string,
  contactId: string,
  data: ContactUpdateInput
): Promise<Contact> {
  const response = await fetch(
    `${API_BASE}/opportunities/${opportunityId}/contacts/${contactId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update contact");
  }

  return response.json();
}

/**
 * Delete a contact
 */
export async function deleteContact(
  opportunityId: string,
  contactId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/opportunities/${opportunityId}/contacts/${contactId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete contact");
  }
}

/**
 * Update contact position in org chart (used for drag-and-drop)
 */
export async function updateContactPosition(
  opportunityId: string,
  contactId: string,
  x: number,
  y: number
): Promise<Contact> {
  return updateContact(opportunityId, contactId, {
    positionX: x,
    positionY: y,
  });
}
