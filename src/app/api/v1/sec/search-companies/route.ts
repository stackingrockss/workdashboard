import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { searchCompaniesByName } from "@/lib/integrations/sec-edgar-improved";

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
    console.error("Error details:", error instanceof Error ? error.stack : String(error));

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : "Failed to search companies";
    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json(
      {
        error: "Failed to search companies",
        ...(isDev && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}
