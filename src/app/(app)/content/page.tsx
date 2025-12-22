import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContentPageClient } from "@/components/features/content/content-page-client";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/auth/login");
  }

  const contents = await prisma.content.findMany({
    where: {
      organizationId: user.organization.id,
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
    orderBy: { createdAt: "desc" },
  });

  // Convert dates to strings for serialization
  const serializedContents = contents.map((content) => ({
    ...content,
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
  }));

  return <ContentPageClient initialContents={serializedContents} />;
}
