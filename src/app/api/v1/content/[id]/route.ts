import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { contentUpdateSchema } from "@/lib/validations/content";

// PATCH /api/v1/content/[id] - Update content
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const json = await req.json();
    const parsed = contentUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify content exists and belongs to user's organization
    const existingContent = await prisma.content.findUnique({
      where: { id },
    });

    if (!existingContent) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (existingContent.organizationId !== user.organization.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for duplicate URL if URL is being updated
    if (parsed.data.url && parsed.data.url !== existingContent.url) {
      const duplicateContent = await prisma.content.findUnique({
        where: {
          organizationId_url: {
            organizationId: user.organization.id,
            url: parsed.data.url,
          },
        },
      });

      if (duplicateContent) {
        return NextResponse.json(
          { error: "Content with this URL already exists" },
          { status: 409 }
        );
      }
    }

    const content = await prisma.content.update({
      where: { id },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.url && { url: parsed.data.url }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.contentType && { contentType: parsed.data.contentType }),
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

    revalidatePath("/content");

    return NextResponse.json({ content });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[PATCH /api/v1/content/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/content/[id] - Delete content
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify content exists and belongs to user's organization
    const existingContent = await prisma.content.findUnique({
      where: { id },
    });

    if (!existingContent) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (existingContent.organizationId !== user.organization.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.content.delete({
      where: { id },
    });

    revalidatePath("/content");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/v1/content/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 }
    );
  }
}
