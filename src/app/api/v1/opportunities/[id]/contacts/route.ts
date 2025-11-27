import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { contactCreateSchema } from "@/lib/validations/contact";
import { requireAuth } from "@/lib/auth";

const prisma = new PrismaClient();

// GET /api/v1/opportunities/[id]/contacts - List all contacts for an opportunity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Fetch all contacts for this opportunity with their manager and direct reports
    const contacts = await prisma.contact.findMany({
      where: { opportunityId: id },
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
      orderBy: {
        createdAt: "asc",
      },
    });

    // Transform contacts to include fullName
    const transformedContacts = contacts.map((contact) => ({
      ...contact,
      fullName: `${contact.firstName} ${contact.lastName}`,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    }));

    return NextResponse.json(transformedContacts);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

// POST /api/v1/opportunities/[id]/contacts - Create a new contact
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = contactCreateSchema.parse(body);

    // If managerId is provided, verify the manager exists and belongs to the same opportunity
    if (validatedData.managerId) {
      const manager = await prisma.contact.findUnique({
        where: { id: validatedData.managerId },
      });

      if (!manager || manager.opportunityId !== id) {
        return NextResponse.json(
          { error: "Invalid manager: Manager must belong to the same opportunity" },
          { status: 400 }
        );
      }
    }

    // Create the contact
    const contact = await prisma.contact.create({
      data: {
        ...validatedData,
        opportunityId: id,
      },
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

    return NextResponse.json(transformedContact, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Error creating contact:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
