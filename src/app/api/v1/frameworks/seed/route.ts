import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_FRAMEWORKS } from "@/lib/ai/prompts/default-frameworks";

/**
 * POST /api/v1/frameworks/seed
 * Seeds default frameworks for the current user's organization
 * Only creates frameworks that don't already exist
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if organization already has any default frameworks
    const existingDefaults = await prisma.contentFramework.count({
      where: {
        organizationId: user.organization.id,
        isDefault: true,
      },
    });

    if (existingDefaults > 0) {
      return NextResponse.json({
        message: "Default frameworks already exist",
        created: 0,
        existing: existingDefaults,
      });
    }

    // Create default frameworks
    const created = [];
    for (const framework of DEFAULT_FRAMEWORKS) {
      try {
        const existing = await prisma.contentFramework.findFirst({
          where: {
            organizationId: user.organization.id,
            name: framework.name,
            scope: "company",
          },
        });

        if (!existing) {
          const newFramework = await prisma.contentFramework.create({
            data: {
              name: framework.name,
              description: framework.description,
              category: framework.category,
              scope: "company",
              systemInstruction: framework.systemInstruction,
              outputFormat: framework.outputFormat,
              sections: JSON.parse(JSON.stringify(framework.sections)),
              contextConfig: JSON.parse(JSON.stringify(framework.contextConfig)),
              createdById: user.id,
              organizationId: user.organization.id,
              isDefault: true,
            },
          });
          created.push(newFramework.name);
        }
      } catch (error) {
        console.error(`Failed to create framework ${framework.name}:`, error);
      }
    }

    return NextResponse.json({
      message: `Created ${created.length} default frameworks`,
      created: created.length,
      frameworks: created,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error seeding frameworks:", error);
    return NextResponse.json(
      { error: "Failed to seed frameworks" },
      { status: 500 }
    );
  }
}
