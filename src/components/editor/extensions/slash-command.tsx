import { Extension } from "@tiptap/core";
import { Editor, Range } from "@tiptap/react";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Table,
  Minus,
  Code,
  Sparkles,
  Image,
  CheckSquare,
} from "lucide-react";
import { ReactNode } from "react";

/**
 * Slash command item definition
 */
export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: "ai" | "formatting" | "blocks" | "advanced";
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

/**
 * Get all available slash commands
 */
export function getSlashCommands(
  onAIPrompt?: () => void
): SlashCommandItem[] {
  return [
    // AI Commands
    {
      id: "ai",
      label: "Ask AI",
      description: "Generate content with AI",
      icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      group: "ai",
      keywords: ["ai", "generate", "write", "help", "assistant"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onAIPrompt?.();
      },
    },

    // Formatting
    {
      id: "heading1",
      label: "Heading 1",
      description: "Large section heading",
      icon: <Heading1 className="h-4 w-4" />,
      group: "formatting",
      keywords: ["heading", "h1", "title", "large"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      id: "heading2",
      label: "Heading 2",
      description: "Medium section heading",
      icon: <Heading2 className="h-4 w-4" />,
      group: "formatting",
      keywords: ["heading", "h2", "subtitle", "medium"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      id: "heading3",
      label: "Heading 3",
      description: "Small section heading",
      icon: <Heading3 className="h-4 w-4" />,
      group: "formatting",
      keywords: ["heading", "h3", "small"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },

    // Blocks
    {
      id: "bullet",
      label: "Bullet List",
      description: "Create a bullet list",
      icon: <List className="h-4 w-4" />,
      group: "blocks",
      keywords: ["bullet", "list", "unordered", "ul"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      id: "numbered",
      label: "Numbered List",
      description: "Create a numbered list",
      icon: <ListOrdered className="h-4 w-4" />,
      group: "blocks",
      keywords: ["numbered", "list", "ordered", "ol"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      id: "quote",
      label: "Quote",
      description: "Add a blockquote",
      icon: <Quote className="h-4 w-4" />,
      group: "blocks",
      keywords: ["quote", "blockquote", "citation"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      id: "divider",
      label: "Divider",
      description: "Add a horizontal line",
      icon: <Minus className="h-4 w-4" />,
      group: "blocks",
      keywords: ["divider", "line", "horizontal", "separator", "hr"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },

    // Advanced
    {
      id: "table",
      label: "Table",
      description: "Insert a table",
      icon: <Table className="h-4 w-4" />,
      group: "advanced",
      keywords: ["table", "grid", "rows", "columns"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      id: "code",
      label: "Code Block",
      description: "Add a code block",
      icon: <Code className="h-4 w-4" />,
      group: "advanced",
      keywords: ["code", "codeblock", "programming", "syntax"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
  ];
}

/**
 * Filter slash commands based on query
 */
export function filterSlashCommands(
  items: SlashCommandItem[],
  query: string
): SlashCommandItem[] {
  const lowerQuery = query.toLowerCase();

  return items.filter((item) => {
    // Match against label
    if (item.label.toLowerCase().includes(lowerQuery)) return true;

    // Match against keywords
    if (item.keywords.some((kw) => kw.includes(lowerQuery))) return true;

    return false;
  });
}

/**
 * Group slash commands by category
 */
export function groupSlashCommands(
  items: SlashCommandItem[]
): Record<string, SlashCommandItem[]> {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = [];
      }
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<string, SlashCommandItem[]>
  );
}

/**
 * Group labels for display
 */
export const GROUP_LABELS: Record<string, string> = {
  ai: "AI",
  formatting: "Formatting",
  blocks: "Blocks",
  advanced: "Advanced",
};

/**
 * Create the slash command extension
 */
export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor">;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
