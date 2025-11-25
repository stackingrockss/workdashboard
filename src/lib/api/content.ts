import { Content } from "@/types/content";
import { ContentCreateInput, ContentUpdateInput } from "../validations/content";

const API_BASE = "/api/v1";

export interface GetContentsResponse {
  contents: Content[];
}

export interface ContentResponse {
  content: Content;
}

export interface ErrorResponse {
  error: string;
}

export async function getContents(type?: string): Promise<Content[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);

  const url = `${API_BASE}/content${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch content");
  }

  const data: GetContentsResponse = await response.json();
  return data.contents;
}

export async function createContent(input: ContentCreateInput): Promise<Content> {
  const response = await fetch(`${API_BASE}/content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create content");
  }

  const data: ContentResponse = await response.json();
  return data.content;
}

export async function updateContent(
  id: string,
  input: ContentUpdateInput
): Promise<Content> {
  const response = await fetch(`${API_BASE}/content/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to update content");
  }

  const data: ContentResponse = await response.json();
  return data.content;
}

export async function deleteContent(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/content/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete content");
  }
}
