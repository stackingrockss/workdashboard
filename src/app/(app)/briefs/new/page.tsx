import { requireAuth } from "@/lib/auth";
import { CreateBriefPage } from "@/components/features/briefs/create-brief-page";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

/**
 * Create New Brief Page
 */
export default async function NewBriefPage({ searchParams }: PageProps) {
  await requireAuth();
  const { returnTo } = await searchParams;

  return <CreateBriefPage returnTo={returnTo} />;
}
