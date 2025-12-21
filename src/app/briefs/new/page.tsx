import { requireAuth } from "@/lib/auth";
import { CreateBriefPage } from "@/components/features/briefs/create-brief-page";

export const dynamic = "force-dynamic";

/**
 * Create New Brief Page
 */
export default async function NewBriefPage() {
  await requireAuth();

  return <CreateBriefPage />;
}
