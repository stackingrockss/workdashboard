// src/app/api/v1/admin/database-sync/route.ts
// Admin endpoint to trigger full database sync to backup
// POST: Trigger full sync
// GET: Check sync status/configuration

import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { getSecondaryPrisma } from "@/lib/db";

/**
 * GET /api/v1/admin/database-sync
 * Check if secondary database is configured and reachable
 */
export async function GET() {
  try {
    const secondaryPrisma = getSecondaryPrisma();

    if (!secondaryPrisma) {
      return NextResponse.json({
        configured: false,
        message: "SECONDARY_DATABASE_URL environment variable not set",
      });
    }

    // Test connection to secondary database
    try {
      await secondaryPrisma.$queryRaw`SELECT 1`;
      return NextResponse.json({
        configured: true,
        connected: true,
        message: "Secondary database is configured and reachable",
      });
    } catch (error) {
      return NextResponse.json({
        configured: true,
        connected: false,
        message: "Secondary database configured but connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Error checking database sync status:", error);
    return NextResponse.json(
      {
        error: "Failed to check sync status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/database-sync
 * Trigger a full database sync to the secondary database
 * Body can optionally include { type: "full" | "incremental" }
 */
export async function POST(request: Request) {
  try {
    const secondaryPrisma = getSecondaryPrisma();

    if (!secondaryPrisma) {
      return NextResponse.json(
        {
          error: "Secondary database not configured",
          message: "Set SECONDARY_DATABASE_URL environment variable",
        },
        { status: 400 }
      );
    }

    // Test connection first
    try {
      await secondaryPrisma.$queryRaw`SELECT 1`;
    } catch (error) {
      return NextResponse.json(
        {
          error: "Cannot connect to secondary database",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 503 }
      );
    }

    // Parse request body
    let syncType: "full" | "incremental" = "full";
    try {
      const body = await request.json();
      if (body.type === "incremental") {
        syncType = "incremental";
      }
    } catch {
      // No body or invalid JSON, default to full sync
    }

    if (syncType === "full") {
      // Trigger full database sync via Inngest
      await inngest.send({
        name: "database/full-sync.requested",
        data: {
          triggeredAt: new Date().toISOString(),
          triggeredBy: "admin-api",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Full database sync job queued",
        type: "full",
        note: "This may take several minutes depending on database size. Check Inngest dashboard for progress.",
      });
    } else {
      // For incremental, we just inform them about the scheduled job
      return NextResponse.json({
        success: true,
        message: "Incremental sync runs automatically every 12 hours via cron",
        type: "incremental",
        note: "The next scheduled sync will pick up any changes. For immediate sync, use type: 'full'",
      });
    }
  } catch (error) {
    console.error("Error triggering database sync:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}