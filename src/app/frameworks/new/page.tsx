import { requireAuth } from "@/lib/auth";
import { CreateFrameworkPage } from "@/components/features/frameworks/create-framework-page";

export const dynamic = "force-dynamic";

/**
 * Create New Framework Page
 */
export default async function NewFrameworkPage() {
  await requireAuth();

  return <CreateFrameworkPage />;
}
