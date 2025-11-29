import { NextRequest, NextResponse } from "next/server";
import { contactCreateSchema } from "@/lib/validations/contact";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

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

    const searchParams = request.nextUrl.searchParams;
    const whereClause = { opportunityId: id };
    const usePagination = wantsPagination(searchParams);

    // Define include for relations
    const includeRelations = {
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
    };

    // Helper to transform contacts
    const transformContact = (contact: {
      firstName: string;
      lastName: string;
      createdAt: Date;
      updatedAt: Date;
      [key: string]: unknown;
    }) => ({
      ...contact,
      fullName: `${contact.firstName} ${contact.lastName}`,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    });

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50, // Default to 50
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50;
      const skip = (page - 1) * limit;

      // Parallel queries for performance
      const [total, contacts] = await Promise.all([
        prisma.contact.count({ where: whereClause }),
        prisma.contact.findMany({
          where: whereClause,
          include: includeRelations,
          orderBy: { createdAt: "asc" },
          skip,
          take: limit,
        }),
      ]);

      const transformedContacts = contacts.map(transformContact);
      return cachedResponse(
        buildPaginatedResponse(transformedContacts, page, limit, total, 'contacts'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all contacts
      const contacts = await prisma.contact.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy: { createdAt: "asc" },
      });

      const transformedContacts = contacts.map(transformContact);
      return cachedResponse(buildLegacyResponse(transformedContacts, 'contacts'), 'frequent');
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logError("API:Opportunities:Contacts:GET", error);
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
      const manager = await prisma.contact.findFirst({
        where: {
          id: validatedData.managerId,
          opportunity: {
            organizationId: user.organization.id
          }
        },
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

    logError("API:Opportunities:Contacts:POST", error);

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
