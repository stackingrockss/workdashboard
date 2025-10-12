import { GongCall } from "@/types/gong-call";
import { GongCallCreateInput } from "../validations/gong-call";

const API_BASE = "/api/v1";

export interface GetGongCallsResponse {
  calls: GongCall[];
}

export interface CreateGongCallResponse {
  call: GongCall;
}

export interface DeleteGongCallResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}

export async function getGongCalls(opportunityId: string): Promise<GongCall[]> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/gong-calls`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Gong calls");
  }

  const data: GetGongCallsResponse = await response.json();
  return data.calls;
}

export async function createGongCall(
  opportunityId: string,
  input: GongCallCreateInput
): Promise<GongCall> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/gong-calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create Gong call");
  }

  const data: CreateGongCallResponse = await response.json();
  return data.call;
}

export async function deleteGongCall(
  opportunityId: string,
  callId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/gong-calls/${callId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete Gong call");
  }
}
