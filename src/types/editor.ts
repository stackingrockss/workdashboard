/**
 * Editor Types for Notion-style AI Editor
 *
 * Types for slash commands, AI writing actions, and editor extensions.
 */

import { Editor, Range } from "@tiptap/react";
import { ReactNode } from "react";

// ============================================================================
// AI Writing Types
// ============================================================================

/**
 * Available AI writing actions
 */
export type AIAction = "generate" | "improve" | "expand" | "shorten" | "tone";

/**
 * Tone options for AI writing
 */
export type ToneOption = "professional" | "casual" | "friendly" | "executive";

/**
 * AI writing request payload
 */
export interface AIWritingRequest {
  action: AIAction;
  text?: string;
  prompt?: string;
  tone?: ToneOption;
  opportunityId?: string;
  documentContext?: string;
}

/**
 * AI writing response (streaming)
 */
export interface AIWritingResponse {
  text: string;
  error?: string;
}

/**
 * AI sidebar chat message
 */
export interface AIEditorChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/**
 * AI sidebar quick action
 */
export interface AIQuickAction {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  prompt: string;
}

// ============================================================================
// Slash Command Types
// ============================================================================

/**
 * Slash command group for categorization
 */
export type SlashCommandGroup = "ai" | "formatting" | "blocks" | "advanced";

/**
 * Slash command definition
 */
export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: SlashCommandGroup;
  keywords?: string[];
  shortcut?: string;
  action: (props: SlashCommandActionProps) => void;
}

/**
 * Props passed to slash command action
 */
export interface SlashCommandActionProps {
  editor: Editor;
  range: Range;
}

/**
 * Slash command suggestion item (for TipTap suggestion)
 */
export interface SlashCommandSuggestionItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: SlashCommandGroup;
  keywords: string[];
  command: (props: SlashCommandActionProps) => void;
}

// ============================================================================
// Editor Extension Props
// ============================================================================

/**
 * Props for RichTextEditor with AI features
 */
export interface RichTextEditorAIProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  disabled?: boolean;
  // AI-specific props
  enableAI?: boolean;
  opportunityId?: string;
  showAISidebar?: boolean;
  onAISidebarToggle?: (open: boolean) => void;
}

/**
 * Props for EditorBubbleMenu
 */
export interface EditorBubbleMenuProps {
  editor: Editor;
  onAIAction: (action: AIAction, text: string, tone?: ToneOption) => Promise<void>;
  isAILoading?: boolean;
}

/**
 * Props for SlashCommandMenu
 */
export interface SlashCommandMenuProps {
  editor: Editor;
  items: SlashCommandSuggestionItem[];
  command: (item: SlashCommandSuggestionItem) => void;
  clientRect: (() => DOMRect | null) | null;
}

/**
 * Props for PlusButtonMenu
 */
export interface PlusButtonMenuProps {
  editor: Editor;
}

/**
 * Props for AISidebar
 */
export interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId?: string;
  documentContent?: string;
  onInsertText?: (text: string) => void;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useEditorAI hook
 */
export interface UseEditorAIReturn {
  // State
  isLoading: boolean;
  error: string | null;
  streamingText: string;

  // Actions
  generateContent: (prompt: string) => Promise<string>;
  improveText: (text: string) => Promise<string>;
  expandText: (text: string) => Promise<string>;
  shortenText: (text: string) => Promise<string>;
  changeTone: (text: string, tone: ToneOption) => Promise<string>;

  // Streaming control
  cancelGeneration: () => void;
  clearError: () => void;
}

// ============================================================================
// System Instruction Types
// ============================================================================

/**
 * AI system instructions by action
 */
export const AI_SYSTEM_INSTRUCTIONS: Record<AIAction, string> = {
  generate: `You are a writing assistant. Generate content based on the user's prompt and any provided context.
Write in clear, professional markdown format. Be concise but thorough.
Return ONLY the generated content, no explanations or preamble.`,

  improve: `You are an editing assistant. Improve the provided text for grammar, clarity, and flow while preserving its meaning and tone.
Fix any spelling or grammatical errors. Improve sentence structure where needed.
Return ONLY the improved text, no explanations.`,

  expand: `You are a writing assistant. Expand the provided text with more detail, examples, and supporting information.
Maintain the original tone and style. Add relevant context and elaboration.
Return ONLY the expanded text, no explanations.`,

  shorten: `You are an editing assistant. Condense the provided text to its key points while preserving essential meaning.
Remove redundancy and unnecessary words. Aim for 40-60% of the original length.
Return ONLY the shortened text, no explanations.`,

  tone: `You are a writing assistant. Rewrite the provided text in the specified tone while preserving the core message.
Adjust vocabulary, sentence structure, and style to match the requested tone.
Return ONLY the rewritten text, no explanations.`,
};

/**
 * Tone-specific instructions
 */
export const TONE_INSTRUCTIONS: Record<ToneOption, string> = {
  professional: "Use formal, business-appropriate language. Be precise and authoritative.",
  casual: "Use conversational, approachable language. Be friendly but informative.",
  friendly: "Use warm, engaging language. Be personable and encouraging.",
  executive: "Use concise, high-level language. Focus on key points and business impact.",
};
