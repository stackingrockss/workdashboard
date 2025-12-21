import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_BRIEFS } from "@/lib/ai/prompts/default-briefs";

/**
 * POST /api/v1/briefs/seed
 * Seeds default briefs for the current user's organization
 * Only creates briefs that don't already exist
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if organization already has any default briefs
    const existingDefaults = await prisma.contentBrief.count({
      where: {
        organizationId: user.organization.id,
        isDefault: true,
      },
    });

    if (existingDefaults > 0) {
      return NextResponse.json({
        message: "Default briefs already exist",
        created: 0,
        existing: existingDefaults,
      });
    }

    // Create default briefs
    const created = [];
    for (const brief of DEFAULT_BRIEFS) {
      try {
        const existing = await prisma.contentBrief.findFirst({
          where: {
            organizationId: user.organization.id,
            name: brief.name,
            scope: "company",
          },
        });

        if (!existing) {
          const newBrief = await prisma.contentBrief.create({
            data: {
              name: brief.name,
              description: brief.description,
              category: brief.category,
              scope: "company",
              systemInstruction: brief.systemInstruction,
              outputFormat: brief.outputFormat,
              sections: JSON.parse(JSON.stringify(brief.sections)),
              contextConfig: JSON.parse(JSON.stringify(brief.contextConfig)),
              createdById: user.id,
              organizationId: user.organization.id,
              isDefault: true,
            },
          });
          created.push(newBrief.name);
        }
      } catch (error) {
        console.error(`Failed to create brief ${brief.name}:`, error);
      }
    }

    return NextResponse.json({
      message: `Created ${created.length} default briefs`,
      created: created.length,
      briefs: created,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error seeding briefs:", error);
    return NextResponse.json(
      { error: "Failed to seed briefs" },
      { status: 500 }
    );
  }
}
