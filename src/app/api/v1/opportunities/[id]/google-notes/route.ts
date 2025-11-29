import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { googleNoteCreateSchema } from "@/lib/validations/google-note";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

// GET /api/v1/opportunities/[id]/google-notes - List all Google notes for an opportunity
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const searchParams = req.nextUrl.searchParams;
    const whereClause = { opportunityId: id };
    const usePagination = wantsPagination(searchParams);

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
      const [total, notes] = await Promise.all([
        prisma.googleNote.count({ where: whereClause }),
        prisma.googleNote.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return cachedResponse(
        buildPaginatedResponse(notes, page, limit, total, 'notes'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all notes
      const notes = await prisma.googleNote.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      return cachedResponse(buildLegacyResponse(notes, 'notes'), 'frequent');
    }
  } catch {
    return NextResponse.json({ error: "Failed to fetch Google notes" }, { status: 500 });
  }
}

// POST /api/v1/opportunities/[id]/google-notes - Create a new Google note
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const json = await req.json();
    const parsed = googleNoteCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const note = await prisma.googleNote.create({
      data: {
        opportunityId: id,
        title: parsed.data.title,
        url: parsed.data.url,
      },
    });

    // Revalidate the opportunity detail page to show new note immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create Google note" }, { status: 500 });
  }
}
