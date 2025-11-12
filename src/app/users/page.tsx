// app/users/page.tsx
// Redirects to Organization Settings > Team tab

import { redirect } from "next/navigation";

/**
 * User management has been moved to Organization Settings
 *
 * Team management is now located in /settings/organization under the "Team" tab.
 * This consolidates all admin functions in one place.
 */
export default function UsersPage() {
  redirect("/settings/organization?tab=team");
}
