/**
 * Contact Role Classifier
 *
 * Uses AI to classify free-form role/title text into one of the Contact role enum values:
 * - decision_maker: C-level, VPs, Directors who approve purchases
 * - influencer: Managers, team leads who influence decisions
 * - champion: Internal advocates pushing for your solution
 * - blocker: People opposing or creating obstacles
 * - end_user: Individual contributors who will use the product
 */

import { generateWithSystemInstruction } from "./gemini";

// ============================================================================
// Types
// ============================================================================

export type ContactRole =
  | "decision_maker"
  | "influencer"
  | "champion"
  | "blocker"
  | "end_user";

export interface RoleClassificationResult {
  success: boolean;
  role?: ContactRole;
  error?: string;
}

// ============================================================================
// System Instruction
// ============================================================================

const SYSTEM_INSTRUCTION = `You are a sales role classifier. Your task is to classify job titles and roles into one of these 5 categories for B2B sales tracking:

1. **decision_maker** - Final purchase approvers
   - C-level executives (CEO, CTO, CFO, COO, CMO, CISO, etc.)
   - VPs (VP of Engineering, VP of Sales, VP of Operations, etc.)
   - Directors with budget authority
   - Owners, Founders, Partners
   - Procurement leads, Purchasing managers
   - Anyone with explicit "Head of" title
   Examples: "CTO", "VP Engineering", "Director of IT", "Head of Product", "CFO"

2. **influencer** - People who shape the decision but don't make final call
   - Managers (Engineering Manager, Product Manager, etc.)
   - Team Leads, Tech Leads
   - Senior individual contributors with influence (Principal Engineer, Staff Engineer, etc.)
   - Department heads without budget authority
   - Committee members, evaluation team members
   Examples: "Engineering Manager", "Senior Product Manager", "Tech Lead", "Principal Engineer"

3. **champion** - Internal advocates actively pushing for your solution
   - Anyone expressing strong support or excitement
   - People who volunteered to help with evaluation
   - Internal sponsors or advocates
   - Early adopters within the organization
   - Note: Can overlap with other roles (e.g., a VP can be both decision_maker and champion)
   - Default to this ONLY if role text explicitly mentions: "champion", "advocate", "sponsor", "supporter"

4. **blocker** - People opposing or creating obstacles
   - Anyone expressing resistance or concerns
   - Competitors' advocates within the organization
   - People satisfied with status quo
   - Note: Can overlap with other roles
   - Default to this ONLY if role text explicitly mentions: "blocker", "opponent", "resistant"

5. **end_user** - Individual contributors who will use the product
   - Engineers, Developers, Designers
   - Analysts, Associates, Coordinators
   - Specialists without management responsibility
   - Interns, Junior roles
   - Any role not fitting the above categories
   Examples: "Software Engineer", "Data Analyst", "UX Designer", "Sales Associate"

CLASSIFICATION RULES:
1. Return ONLY the enum value as plain text: decision_maker, influencer, champion, blocker, or end_user
2. NO JSON, NO explanation, NO quotes - just the enum value
3. When uncertain between two categories, prefer the higher authority level (e.g., "Senior Manager" → influencer, not end_user)
4. "Manager" in title → influencer (unless "Account Manager" or similar IC role → end_user)
5. "Senior" or "Staff" without management → end_user (unless Principal/Distinguished → influencer)
6. If role is vague or unknown, default to end_user
7. Focus on the title/role itself, not the person's sentiment or behavior (unless "champion" or "blocker" is explicit)

Examples:
Input: "Chief Technology Officer" → decision_maker
Input: "VP of Sales" → decision_maker
Input: "Engineering Manager" → influencer
Input: "Senior Software Engineer" → end_user
Input: "Product Manager" → influencer
Input: "Data Analyst" → end_user
Input: "Director of Engineering" → decision_maker
Input: "Tech Lead" → influencer
Input: "CEO" → decision_maker`;

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classifies a free-form role/title into a Contact role enum value.
 *
 * @param roleText - The role/title to classify (e.g., "VP of Engineering", "Software Developer")
 * @returns Classification result with success flag and role enum value
 *
 * @example
 * const result = await classifyContactRole("VP of Engineering");
 * // Returns: { success: true, role: "decision_maker" }
 */
export async function classifyContactRole(
  roleText: string
): Promise<RoleClassificationResult> {
  try {
    // Validate input
    if (!roleText || roleText.trim().length === 0) {
      return {
        success: false,
        error: "Role text is required",
      };
    }

    // Build the classification prompt
    const prompt = `Classify this role: ${roleText.trim()}`;

    // Call Gemini with system instruction
    const response = await generateWithSystemInstruction(
      prompt,
      SYSTEM_INSTRUCTION,
      "gemini-2.5-flash" // Flash is sufficient for simple classification
    );

    if (response.error || !response.text) {
      return {
        success: false,
        error: response.error || "Failed to classify role",
      };
    }

    // Parse response (should be plain text enum value)
    const role = response.text.trim().toLowerCase() as ContactRole;

    // Validate enum value
    const validRoles: ContactRole[] = [
      "decision_maker",
      "influencer",
      "champion",
      "blocker",
      "end_user",
    ];

    if (!validRoles.includes(role)) {
      return {
        success: false,
        error: `Invalid role returned from AI: ${role}`,
      };
    }

    return {
      success: true,
      role,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Batch classifies multiple roles in a single call (for efficiency).
 *
 * @param roles - Array of role texts to classify
 * @returns Array of classification results in the same order
 *
 * @example
 * const results = await classifyContactRolesBatch(["CTO", "Software Engineer", "VP Sales"]);
 * // Returns: [{ success: true, role: "decision_maker" }, { success: true, role: "end_user" }, ...]
 */
export async function classifyContactRolesBatch(
  roles: string[]
): Promise<RoleClassificationResult[]> {
  // For now, classify sequentially
  // TODO: Optimize with batch API call if Gemini supports it
  const results: RoleClassificationResult[] = [];

  for (const roleText of roles) {
    const result = await classifyContactRole(roleText);
    results.push(result);
  }

  return results;
}
