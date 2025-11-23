import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { searchCompaniesByName } from "@/lib/integrations/sec-edgar";

// GET /api/v1/sec/search-companies?q=apple - Search for companies by name
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const companies = await searchCompaniesByName(query.trim());

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error searching companies:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to search companies" },
      { status: 500 }
    );
  }
}
