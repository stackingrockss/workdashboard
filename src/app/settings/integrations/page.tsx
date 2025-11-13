// app/settings/integrations/page.tsx
// Redirects to User Settings > Integrations tab

import { redirect } from "next/navigation";

/**
 * Integrations have been moved to User Settings
 *
 * Integration management is now located in /settings under the "Integrations" tab.
 * This allows each user to connect their own personal integrations (Google Calendar, etc.)
 * with individual authentication and OAuth tokens.
 */
export default function IntegrationsSettingsPage() {
  redirect("/settings?tab=integrations");
}
