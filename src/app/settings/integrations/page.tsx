// app/settings/integrations/page.tsx
// Redirects to Organization Settings > Integrations tab

import { redirect } from "next/navigation";

/**
 * Integrations have been moved to Organization Settings
 *
 * Integration management is now located in /settings/organization under the "Integrations" tab.
 * This consolidates all admin settings in one place.
 */
export default function IntegrationsSettingsPage() {
  redirect("/settings/organization?tab=integrations");
}
