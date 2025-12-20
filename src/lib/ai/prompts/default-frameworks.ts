/**
 * Default Framework Templates for AI Content Generation
 *
 * These templates are seeded for new organizations and serve as starting points
 * for users to create their own custom frameworks.
 */

import { FrameworkCategory, FrameworkSection, ContextConfig } from "@/types/framework";

export interface DefaultFramework {
  name: string;
  description: string;
  category: FrameworkCategory;
  systemInstruction: string;
  outputFormat?: string;
  sections: FrameworkSection[];
  contextConfig: ContextConfig;
}

export const DEFAULT_FRAMEWORKS: DefaultFramework[] = [
  {
    name: "Mutual Action Plan",
    description: "A collaborative project plan with action items, owners, and timelines working backward from close date",
    category: "mutual_action_plan",
    systemInstruction: `You are an expert sales strategist creating a Mutual Action Plan (MAP) for a B2B enterprise deal.

A Mutual Action Plan is a collaborative document shared between the sales team and the customer that outlines the key steps, owners, and timelines needed to successfully complete a purchase.

Your goal is to create a practical, actionable plan that:
1. Works backward from the close date to establish realistic milestones
2. Assigns clear ownership to both vendor and customer stakeholders
3. Identifies potential blockers and addresses them proactively
4. Includes specific dates and deadlines
5. Reflects commitments and next steps discussed in sales calls`,
    outputFormat: `Output as a markdown document with tables for action items. Each action item should have:
- Description
- Owner (from customer or vendor side)
- Target Date
- Status (Not Started, In Progress, Complete)
- Notes/Dependencies`,
    sections: [
      { title: "Partnership Goals", description: "Shared objectives for the partnership", required: true },
      { title: "Key Stakeholders", description: "Decision makers and influencers from both sides", required: true },
      { title: "Action Items", description: "Table of tasks with owners, dates, and status", required: true },
      { title: "Timeline", description: "Visual milestone timeline", required: true },
      { title: "Success Criteria", description: "How we measure success", required: false },
      { title: "Risks & Mitigations", description: "Potential blockers and how to address them", required: false },
    ],
    contextConfig: {
      meetings: true,
      notes: true,
      accountResearch: false,
    },
  },
  {
    name: "1-Click Business Case",
    description: "Executive summary with ROI analysis, problem statement, and implementation roadmap",
    category: "business_case",
    systemInstruction: `You are a business analyst creating a compelling business case document for a B2B software purchase.

Your goal is to create a business case that:
1. Clearly articulates the business problem and its impact
2. Presents a compelling solution with quantifiable benefits
3. Provides realistic ROI calculations based on available data
4. Addresses potential objections and risks
5. Makes it easy for a decision maker to approve the purchase

Use specific data points from call insights whenever possible. If exact numbers aren't available, provide reasonable estimates with clear assumptions.`,
    sections: [
      { title: "Executive Summary", description: "One-paragraph overview of the opportunity", required: true },
      { title: "Business Problem", description: "Current challenges and their impact", required: true },
      { title: "Proposed Solution", description: "How the solution addresses the problem", required: true },
      { title: "ROI Analysis", description: "Quantified benefits and payback period", required: true },
      { title: "Implementation Plan", description: "High-level timeline and approach", required: true },
      { title: "Risk Assessment", description: "Potential risks and mitigation strategies", required: false },
      { title: "Next Steps", description: "Recommended actions to move forward", required: true },
    ],
    contextConfig: {
      meetings: true,
      notes: true,
      accountResearch: true,
    },
  },
  {
    name: "Business Impact Proposal",
    description: "8-section proposal for executive decision-making with problem framing and solution positioning",
    category: "proposal",
    systemInstruction: `You are a senior sales consultant creating a Business Impact Proposal for executive stakeholders.

This proposal should be suitable for sharing with C-level executives and decision makers. It needs to:
1. Frame the business problem in terms executives care about
2. Connect the solution to strategic business outcomes
3. Provide concrete evidence and proof points
4. Make the decision path clear and risk-free
5. Create urgency without being pushy

Write in a professional, consultative tone that positions you as a trusted advisor rather than a vendor.`,
    sections: [
      { title: "Current State Assessment", description: "Analysis of the customer's current situation", required: true },
      { title: "Business Challenges", description: "Key problems and their business impact", required: true },
      { title: "Strategic Vision", description: "The desired future state", required: true },
      { title: "Recommended Solution", description: "How the solution enables the vision", required: true },
      { title: "Expected Outcomes", description: "Measurable business outcomes", required: true },
      { title: "Investment Summary", description: "Pricing and value proposition", required: true },
      { title: "Implementation Approach", description: "How we'll get there together", required: true },
      { title: "Why Now", description: "The cost of delay and urgency factors", required: true },
    ],
    contextConfig: {
      meetings: true,
      notes: true,
      accountResearch: true,
    },
  },
  {
    name: "Discovery Call Follow-up Email",
    description: "Professional follow-up email after initial discovery call summarizing key points and next steps",
    category: "email",
    systemInstruction: `You are a sales professional writing a follow-up email after a discovery call.

The email should:
1. Thank the attendees for their time
2. Summarize the key points discussed (problems, goals, timeline)
3. Confirm understanding of their needs
4. Propose clear next steps
5. Be concise and scannable (max 250 words)

Write in a professional but warm tone. Use bullet points for easy scanning. Include specific details from the call to show you were listening.`,
    outputFormat: `Output as a complete email with:
- Subject line (start with "Subject: ")
- Professional greeting
- Body with bullet points
- Clear call to action
- Professional sign-off`,
    sections: [
      { title: "Subject Line", description: "Compelling email subject", required: true },
      { title: "Opening", description: "Thank you and context setting", required: true },
      { title: "Key Takeaways", description: "Summary of what was discussed", required: true },
      { title: "Next Steps", description: "Proposed actions and timeline", required: true },
      { title: "Closing", description: "Professional sign-off", required: true },
    ],
    contextConfig: {
      meetings: true,
      notes: false,
      accountResearch: false,
    },
  },
  {
    name: "Account Plan",
    description: "Comprehensive account strategy document with stakeholder mapping and growth opportunities",
    category: "account_plan",
    systemInstruction: `You are a strategic account manager creating an Account Plan for a key customer.

This document should provide a comprehensive view of the account including:
1. Account overview and business context
2. Current relationship and engagement history
3. Stakeholder map and decision-making process
4. Growth opportunities and white space analysis
5. Competition and differentiation strategy
6. Action plan for account development

Be strategic and forward-looking while grounding recommendations in actual data and relationships.`,
    sections: [
      { title: "Account Overview", description: "Company background and strategic priorities", required: true },
      { title: "Relationship Summary", description: "Current state of the relationship", required: true },
      { title: "Stakeholder Map", description: "Key contacts and their roles", required: true },
      { title: "Opportunity Analysis", description: "Current and potential opportunities", required: true },
      { title: "Competitive Position", description: "Competitive landscape and differentiation", required: false },
      { title: "Growth Strategy", description: "Plan to expand the relationship", required: true },
      { title: "Action Plan", description: "Specific next steps with owners", required: true },
    ],
    contextConfig: {
      meetings: true,
      notes: true,
      accountResearch: true,
    },
  },
  {
    name: "3 Why's Executive Summary",
    description: "Why Change, Why Now, Why Us - executive briefing for decision makers",
    category: "executive_summary",
    systemInstruction: `You are creating an Executive Summary using the "3 Why's" framework - a powerful structure for executive presentations.

The 3 Why's framework addresses:
1. WHY CHANGE: Why the status quo is no longer acceptable
2. WHY NOW: Why this decision needs to happen now, not later
3. WHY US: Why your solution is the best choice

Each section should be concise, compelling, and backed by specific evidence from the customer's own words and situation. This is meant to be a quick read that gets executives aligned and ready to move forward.`,
    sections: [
      { title: "Why Change", description: "The compelling case for change from status quo", required: true },
      { title: "Why Now", description: "The urgency and cost of delay", required: true },
      { title: "Why Us", description: "Differentiation and unique value", required: true },
      { title: "Recommended Path Forward", description: "Clear next steps", required: true },
    ],
    contextConfig: {
      meetings: true,
      notes: true,
      accountResearch: true,
    },
  },
  {
    name: "Consulting Style Executive Summary",
    description: "Situation, Complication, Recommendation format for strategic clarity",
    category: "executive_summary",
    systemInstruction: `You are a management consultant creating an Executive Summary using the SCR (Situation-Complication-Resolution) framework.

This format is used by top consulting firms for its clarity and impact:
1. SITUATION: Objective description of the current state
2. COMPLICATION: The problem or change that requires action
3. RECOMMENDATION: The proposed solution and path forward

Write in a clear, authoritative tone. Be specific with data points. Make recommendations actionable and time-bound.`,
    sections: [
      { title: "Situation", description: "Current state and context", required: true },
      { title: "Complication", description: "The problem requiring action", required: true },
      { title: "Recommendation", description: "Proposed solution and approach", required: true },
      { title: "Key Actions", description: "Immediate next steps", required: true },
    ],
    contextConfig: {
      meetings: true,
      notes: true,
      accountResearch: false,
    },
  },
];

/**
 * Get a default framework by name
 */
export function getDefaultFrameworkByName(name: string): DefaultFramework | undefined {
  return DEFAULT_FRAMEWORKS.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get all default frameworks for a specific category
 */
export function getDefaultFrameworksByCategory(category: FrameworkCategory): DefaultFramework[] {
  return DEFAULT_FRAMEWORKS.filter((f) => f.category === category);
}
