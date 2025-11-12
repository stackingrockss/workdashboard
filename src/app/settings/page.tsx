import { redirect } from "next/navigation";

/**
 * Settings root page
 *
 * Redirects to /settings/organization where all organization-level
 * settings are consolidated (admin only).
 *
 * This eliminates duplicate fiscal year and organization settings
 * that were previously split across multiple pages.
 */
export default function SettingsPage() {
  redirect("/settings/organization");
}