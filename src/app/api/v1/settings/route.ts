import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { companySettingsSchema } from "@/lib/validations/company-settings";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate } from "@/lib/utils/quarter";

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

    // If fiscal year changed, recalculate all opportunity quarters
    if (fiscalYearChanged || !existingSettings) {
      console.log(
        `Fiscal year changed to month ${data.fiscalYearStartMonth}, recalculating quarters...`
      );

      // Recalculate quarters for all opportunities with close dates
      const opportunities = await prisma.opportunity.findMany({
        where: {
          ownerId: user.id,
          closeDate: { not: null },
        },
      });

      console.log(`Recalculating quarters for ${opportunities.length} opportunities`);

      // Update each opportunity's quarter field
      for (const opp of opportunities) {
        if (opp.closeDate) {
          const newQuarter = getQuarterFromDate(
            opp.closeDate,
            data.fiscalYearStartMonth
          );
          await prisma.opportunity.update({
            where: { id: opp.id },
            data: { quarter: newQuarter },
          });
        }
      }

      console.log(`Updated ${opportunities.length} opportunities with new quarters`);
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
