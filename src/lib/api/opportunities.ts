import { Opportunity } from "@/types/opportunity";
import { OpportunityCreateInput, OpportunityUpdateInput } from "../validations/opportunity";

const API_BASE = "/api/v1";

export interface GetOpportunitiesResponse {
  opportunities: Opportunity[];
}

export interface GetOpportunityResponse {
  opportunity: Opportunity;
}

export interface CreateOpportunityResponse {
  opportunity: Opportunity;
}

export interface UpdateOpportunityResponse {
  opportunity: Opportunity;
}

export interface DeleteOpportunityResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}

export async function getOpportunities(): Promise<Opportunity[]> {
  const response = await fetch(`${API_BASE}/opportunities`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch opportunities");
  }

  const data: GetOpportunitiesResponse = await response.json();
  return data.opportunities;
}

export async function getOpportunity(id: string): Promise<Opportunity> {
  const response = await fetch(`${API_BASE}/opportunities/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Opportunity not found");
    }
    throw new Error("Failed to fetch opportunity");
  }

  const data: GetOpportunityResponse = await response.json();
  return data.opportunity;
}

export async function createOpportunity(
  input: OpportunityCreateInput
): Promise<Opportunity> {
  console.log("Creating opportunity with data:", input);
  const response = await fetch(`${API_BASE}/opportunities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Create opportunity error:", errorData);
    throw new Error(errorData.error || "Failed to create opportunity");
  }

  const data: CreateOpportunityResponse = await response.json();
  return data.opportunity;
}

export async function updateOpportunity(
  id: string,
  input: OpportunityUpdateInput
): Promise<Opportunity> {
  const response = await fetch(`${API_BASE}/opportunities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to update opportunity");
  }

  const data: UpdateOpportunityResponse = await response.json();
  return data.opportunity;
}

export async function deleteOpportunity(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/opportunities/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete opportunity");
  }
}

export async function updateOpportunityField(
  id: string,
  field: keyof OpportunityUpdateInput,
  value: unknown
): Promise<Opportunity> {
  return updateOpportunity(id, { [field]: value } as OpportunityUpdateInput);
}
