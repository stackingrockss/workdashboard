import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCikFromTicker } from "@/lib/integrations/sec-edgar";

// GET /api/v1/sec/search-company?ticker=AAPL - Search for company by ticker
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json(
        { error: "Ticker parameter is required" },
        { status: 400 }
      );
    }

    const cik = await getCikFromTicker(ticker);

    return NextResponse.json({
      company: {
        ticker: ticker.toUpperCase(),
        cik,
      },
    });
  } catch (error) {
    console.error("Error searching company:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      error instanceof Error &&
      error.message.includes("not found in SEC database")
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to search company" },
      { status: 500 }
    );
  }
}
