import { OpportunityOwner } from "@/types/opportunity";

const API_BASE = "/api/v1";

export interface GetUsersResponse {
  users: OpportunityOwner[];
}

export async function getUsers(): Promise<OpportunityOwner[]> {
  const response = await fetch(`${API_BASE}/users`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  const data: GetUsersResponse = await response.json();
  // Defensive check - ensure we return an array
  return Array.isArray(data?.users) ? data.users : [];
}
