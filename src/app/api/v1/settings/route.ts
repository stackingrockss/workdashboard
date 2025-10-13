import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { companySettingsSchema } from "@/lib/validations/company-settings";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate, getNextQuarters } from "@/lib/utils/quarter";

export async function GET() {
  try {
    const user = await requireAuth();

    const settings = await prisma.companySettings.findUnique({
      where: { userId: user.id },
    });

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        settings: {
          companyName: null,
          companyWebsite: null,
          fiscalYearStartMonth: 1,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = companySettingsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Check if fiscal year start month is changing
    const existingSettings = await prisma.companySettings.findUnique({
      where: { userId: user.id },
    });

    const fiscalYearChanged =
      existingSettings &&
      existingSettings.fiscalYearStartMonth !== data.fiscalYearStartMonth;

    // Upsert settings (create if doesn't exist, update if it does)
    const settings = await prisma.companySettings.upsert({
      where: { userId: user.id },
      update: {
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
      },
      create: {
        userId: user.id,
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
      },
    });

    // If fiscal year changed, recalculate all opportunity quarters and update kanban columns
    if (fiscalYearChanged || !existingSettings) {
      console.log(
        `Fiscal year changed to month ${data.fiscalYearStartMonth}, recalculating quarters...`
      );

      // 1. Recalculate quarters for all opportunities with close dates
      const opportunities = await prisma.opportunity.findMany({
        where: {
          ownerId: user.id,
          closeDate: { not: null },
        },
      });

      console.log(`Recalculating quarters for ${opportunities.length} opportunities`);

      // Store opportunity updates to apply after columns are created
      const opportunityUpdates: Array<{ id: string; quarter: string }> = [];
      for (const opp of opportunities) {
        if (opp.closeDate) {
          const newQuarter = getQuarterFromDate(
            opp.closeDate,
            data.fiscalYearStartMonth
          );
          opportunityUpdates.push({ id: opp.id, quarter: newQuarter });
        }
      }

      // 2. Auto-create/update kanban columns for current + next 3 quarters
      const quarterStrings = getNextQuarters(4, data.fiscalYearStartMonth);
      console.log(`Creating/updating columns for quarters: ${quarterStrings.join(", ")}`);

      // Get existing columns for this user
      const existingColumns = await prisma.kanbanColumn.findMany({
        where: { userId: user.id },
        orderBy: { order: "asc" },
      });

      // Delete old quarter-based columns (those with titles matching "Q\d \d{4}" pattern)
      const quarterPattern = /^Q[1-4]\s\d{4}$/;
      const columnsToDelete = existingColumns.filter((col) =>
        quarterPattern.test(col.title)
      );

      if (columnsToDelete.length > 0) {
        await prisma.kanbanColumn.deleteMany({
          where: {
            id: { in: columnsToDelete.map((col) => col.id) },
          },
        });
        console.log(`Deleted ${columnsToDelete.length} old quarter columns`);
      }

      // Create new quarter columns
      const newColumns: Record<string, string> = {};
      for (let i = 0; i < quarterStrings.length; i++) {
        const column = await prisma.kanbanColumn.create({
          data: {
            title: quarterStrings[i],
            order: i,
            userId: user.id,
          },
        });
        newColumns[quarterStrings[i]] = column.id;
      }

      console.log(`Created ${quarterStrings.length} new quarter columns`);

      // 3. Now update opportunities with their new quarters and columnIds
      for (const update of opportunityUpdates) {
        const columnId = newColumns[update.quarter];
        await prisma.opportunity.update({
          where: { id: update.id },
          data: {
            quarter: update.quarter,
            columnId: columnId || null,
          },
        });
      }

      console.log(`Updated ${opportunityUpdates.length} opportunities with new quarters and columns`);
    }

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
