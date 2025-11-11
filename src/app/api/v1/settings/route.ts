import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate } from "@/lib/utils/quarter";

// Validation schema for organization settings (fiscal year only)
const settingsSchema = z.object({
  fiscalYearStartMonth: z.number().int().min(1).max(12),
});

export async function GET() {
  try {
    const user = await requireAuth();

    // Get user's organization
    const userWithOrg = await prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });

    if (!userWithOrg?.organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Return organization fiscal year settings
    return NextResponse.json({
      settings: {
        fiscalYearStartMonth: userWithOrg.organization.fiscalYearStartMonth,
      },
    });
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
    const parsed = settingsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Get user's organization
    const userWithOrg = await prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });

    if (!userWithOrg?.organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const organization = userWithOrg.organization;

    // Check if fiscal year start month is changing
    const fiscalYearChanged = organization.fiscalYearStartMonth !== data.fiscalYearStartMonth;

    // Update organization's fiscal year start month
    const updatedOrg = await prisma.organization.update({
      where: { id: organization.id },
      data: { fiscalYearStartMonth: data.fiscalYearStartMonth },
    });

    // If fiscal year changed, recalculate all opportunity quarters for this organization
    if (fiscalYearChanged) {
      console.log(
        `Fiscal year changed to month ${data.fiscalYearStartMonth}, recalculating quarters...`
      );

      // Recalculate quarters for all opportunities in this organization with close dates
      const opportunities = await prisma.opportunity.findMany({
        where: {
          owner: { organizationId: organization.id },
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

    return NextResponse.json({
      settings: {
        fiscalYearStartMonth: updatedOrg.fiscalYearStartMonth,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
