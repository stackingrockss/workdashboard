import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getTemplateBriefById, isTemplateBriefId } from "@/lib/briefs/template-briefs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/briefs/[id]/duplicate - Duplicate a brief (including templates)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check if duplicating a template brief
    if (isTemplateBriefId(id)) {
      const templateBrief = getTemplateBriefById(id);
      if (!templateBrief) {
        return NextResponse.json(
          { error: "Brief not found" },
          { status: 404 }
        );
      }

      // Generate a unique name for the duplicate
      let duplicateName = `${templateBrief.name} (Copy)`;
      let counter = 1;

      while (true) {
        const existing = await prisma.contentBrief.findFirst({
          where: {
            organizationId: user.organization.id,
            name: duplicateName,
            scope: "personal",
            createdById: user.id,
          },
        });

        if (!existing) break;

        counter++;
        duplicateName = `${templateBrief.name} (Copy ${counter})`;
      }

      // Create the duplicate from template
      const duplicate = await prisma.contentBrief.create({
        data: {
          name: duplicateName,
          description: templateBrief.description,
          category: templateBrief.category,
          scope: "personal",
          systemInstruction: templateBrief.systemInstruction,
          outputFormat: templateBrief.outputFormat,
          sections: templateBrief.sections as unknown as Prisma.InputJsonValue,
          contextConfig: templateBrief.contextConfig as Prisma.InputJsonValue | undefined,
          createdById: user.id,
          organizationId: user.organization.id,
          isDefault: false,
          usageCount: 0,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      return NextResponse.json(
        { brief: { ...duplicate, referenceContents: [] } },
        { status: 201 }
      );
    }

    // Find the original database brief
    const original = await prisma.contentBrief.findFirst({
      where: {
        id,
        // User can duplicate company briefs or their own personal briefs
        OR: [
          { organizationId: user.organization.id, scope: "company" },
          { scope: "personal", createdById: user.id },
        ],
      },
      include: {
        referenceContents: {
          orderBy: { order: "asc" },
          select: { contentId: true, order: true },
        },
      },
    });

    if (!original) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }

    // Generate a unique name for the duplicate
    let duplicateName = `${original.name} (Copy)`;
    let counter = 1;

    // Check for existing duplicates and increment counter if needed
    while (true) {
      const existing = await prisma.contentBrief.findFirst({
        where: {
          organizationId: user.organization.id,
          name: duplicateName,
          scope: "personal", // Duplicates are always personal
          createdById: user.id,
        },
      });

      if (!existing) break;

      counter++;
      duplicateName = `${original.name} (Copy ${counter})`;
    }

    // Create the duplicate in a transaction
    const duplicate = await prisma.$transaction(async (tx) => {
      // Create the new brief (always as personal, owned by current user)
      const newBrief = await tx.contentBrief.create({
        data: {
          name: duplicateName,
          description: original.description,
          category: original.category,
          scope: "personal", // Duplicates are always personal
          systemInstruction: original.systemInstruction,
          outputFormat: original.outputFormat,
          sections: original.sections as Prisma.InputJsonValue,
          contextConfig: original.contextConfig as Prisma.InputJsonValue | undefined,
          createdById: user.id,
          organizationId: user.organization.id,
          isDefault: false,
          usageCount: 0, // Reset usage count
        },
      });

      // Copy reference content associations if any
      if (original.referenceContents.length > 0) {
        await tx.briefReferenceContent.createMany({
          data: original.referenceContents.map((rc) => ({
            briefId: newBrief.id,
            contentId: rc.contentId,
            order: rc.order,
          })),
        });
      }

      // Return the created brief with relations
      return tx.contentBrief.findUnique({
        where: { id: newBrief.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          referenceContents: {
            orderBy: { order: "asc" },
            include: {
              content: {
                select: {
                  id: true,
                  title: true,
                  contentType: true,
                  description: true,
                },
              },
            },
          },
        },
      });
    });

    // Transform to flatten reference contents
    const transformedBrief = {
      ...duplicate,
      referenceContents: duplicate?.referenceContents?.map((rc) => rc.content) || [],
    };

    return NextResponse.json({ brief: transformedBrief }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error duplicating brief:", error);
    return NextResponse.json(
      { error: "Failed to duplicate brief" },
      { status: 500 }
    );
  }
}
