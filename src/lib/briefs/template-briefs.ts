/**
 * Template Briefs Utility
 *
 * Converts DEFAULT_BRIEFS from code to ContentBrief shape for display and use.
 * Template briefs are global, read-only briefs available to all users.
 */

import { DEFAULT_BRIEFS } from "@/lib/ai/prompts/default-briefs";
import { ContentBrief, BriefSection, ContextConfig } from "@/types/brief";

/**
 * Generate a stable ID for a template brief based on index and name
 */
function generateTemplateId(index: number, name: string): string {
  const kebabName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `template-${index}-${kebabName}`;
}

/**
 * Check if an ID is a template brief ID
 */
export function isTemplateBriefId(id: string): boolean {
  return id.startsWith("template-");
}

/**
 * Get all template briefs converted to ContentBrief shape
 */
export function getTemplateBriefs(): ContentBrief[] {
  return DEFAULT_BRIEFS.map((brief, index) => ({
    id: generateTemplateId(index, brief.name),
    name: brief.name,
    description: brief.description,
    category: brief.category,
    scope: "template" as const,
    systemInstruction: brief.systemInstruction,
    outputFormat: brief.outputFormat || null,
    sections: brief.sections as BriefSection[],
    contextConfig: brief.contextConfig as ContextConfig | null,
    isDefault: true,
    usageCount: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    createdById: null,
    organizationId: null,
    createdBy: null,
    referenceContents: [],
  }));
}

/**
 * Get a single template brief by ID
 */
export function getTemplateBriefById(id: string): ContentBrief | undefined {
  if (!isTemplateBriefId(id)) {
    return undefined;
  }
  return getTemplateBriefs().find((b) => b.id === id);
}

/**
 * Get a template brief by name (case-insensitive)
 */
export function getTemplateBriefByName(name: string): ContentBrief | undefined {
  return getTemplateBriefs().find(
    (b) => b.name.toLowerCase() === name.toLowerCase()
  );
}
