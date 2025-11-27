import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { contactUpdateSchema } from "@/lib/validations/contact";
import { requireAuth } from "@/lib/auth";

const prisma = new PrismaClient();

// GET /api/v1/accounts/[id]/contacts/[contactId] - Get a specific contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, contactId } = await params;

    // Verify account belongs to user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            role: true,
          },
        },
        directReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            role: true,
          },
        },
      },
    });

    if (!contact || contact.accountId !== id) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Transform contact to include fullName
    const transformedContact = {
      ...contact,
      fullName: `${contact.firstName} ${contact.lastName}`,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };

    return NextResponse.json(transformedContact);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/accounts/[id]/contacts/[contactId] - Update a contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, contactId } = await params;
    const body = await request.json();

    // Verify account belongs to user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Verify contact exists and belongs to this account
    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existingContact || existingContact.accountId !== id) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = contactUpdateSchema.parse(body);

    // If managerId is being updated, verify the manager exists and belongs to the same account
    if (validatedData.managerId !== undefined && validatedData.managerId !== null) {
      // Prevent self-referencing (contact can't be their own manager)
      if (validatedData.managerId === contactId) {
        return NextResponse.json(
          { error: "A contact cannot be their own manager" },
          { status: 400 }
        );
      }

      const manager = await prisma.contact.findUnique({
        where: { id: validatedData.managerId },
      });

      if (!manager || manager.accountId !== id) {
        return NextResponse.json(
          { error: "Invalid manager: Manager must belong to the same account" },
          { status: 400 }
        );
      }

      // Prevent circular references (manager can't report to this contact)
      const wouldCreateCircle = await checkCircularReference(
        contactId,
        validatedData.managerId
      );

      if (wouldCreateCircle) {
        return NextResponse.json(
          { error: "Cannot create circular reporting relationship" },
          { status: 400 }
        );
      }
    }

    // Update the contact
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: validatedData,
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            role: true,
          },
        },
        directReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            role: true,
          },
        },
      },
    });

    // Transform contact to include fullName
    const transformedContact = {
      ...contact,
      fullName: `${contact.firstName} ${contact.lastName}`,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };

    return NextResponse.json(transformedContact);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Error updating contact:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/accounts/[id]/contacts/[contactId] - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, contactId } = await params;

    // Verify account belongs to user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Verify contact exists and belongs to this account
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.accountId !== id) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Delete the contact (direct reports will have their managerId set to null due to onDelete: SetNull)
    await prisma.contact.delete({
      where: { id: contactId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}

// Helper function to check for circular references in the reporting structure
async function checkCircularReference(
  contactId: string,
  proposedManagerId: string
): Promise<boolean> {
  let currentManagerId: string | null = proposedManagerId;

  // Traverse up the management chain
  while (currentManagerId) {
    // If we find the original contact in the chain, it's circular
    if (currentManagerId === contactId) {
      return true;
    }

    // Get the next manager in the chain
    const manager: { managerId: string | null } | null = await prisma.contact.findUnique({
      where: { id: currentManagerId },
      select: { managerId: true },
    });

    currentManagerId = manager?.managerId || null;
  }

  return false;
}
