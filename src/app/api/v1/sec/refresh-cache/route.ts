import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { forceRefreshSecCache } from "@/lib/integrations/sec-edgar-improved";

// POST /api/v1/sec/refresh-cache - Manually refresh SEC company cache
export async function POST() {
  try {
    const user = await requireAuth();

    // Only admins can manually refresh cache
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    console.log("Manual SEC cache refresh triggered by:", user.email);

    await forceRefreshSecCache();

    return NextResponse.json({
      message: "SEC company cache refreshed successfully",
    });
  } catch (error) {
    console.error("Error refreshing SEC cache:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.stack : String(error)
    );

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Failed to refresh cache";
    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json(
      {
        error: "Failed to refresh SEC cache",
        ...(isDev && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
