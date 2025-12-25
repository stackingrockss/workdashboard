"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  TableIcon,
  Plus,
  Trash2,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// AI Editor Components
import { EditorBubbleMenu } from "@/components/editor/EditorBubbleMenu";
import { PlusButtonMenu } from "@/components/editor/PlusButtonMenu";
import { AISidebar, AISidebarToggle } from "@/components/editor/AISidebar";
import { AIPromptDialog } from "@/components/editor/AIPromptDialog";
import {
  SlashCommand,
  SlashCommandItem,
  getSlashCommands,
  filterSlashCommands,
} from "@/components/editor/extensions/slash-command";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import {
  SlashCommandMenu,
  SlashCommandMenuRef,
} from "@/components/editor/SlashCommandMenu";
import { useEditorAI } from "@/hooks/useEditorAI";
import { AIAction, ToneOption } from "@/types/editor";

// Type for the markdown storage
interface MarkdownStorage {
  getMarkdown: () => string;
  parser: {
    parse: (markdown: string) => string;
  };
}

// Helper to safely get markdown from editor
function getMarkdownContent(editor: Editor | null): string {
  if (!editor) return "";
  const storage = editor.storage as { markdown?: MarkdownStorage };
  return storage.markdown?.getMarkdown() ?? "";
}

// Helper to parse markdown to HTML using the tiptap-markdown parser
function parseMarkdownToHtml(editor: Editor | null, markdown: string): string {
  if (!editor) return markdown;
  const storage = editor.storage as { markdown?: MarkdownStorage };
  if (storage.markdown?.parser) {
    return storage.markdown.parser.parse(markdown);
  }
  return markdown;
}

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  disabled?: boolean;
  // AI features
  enableAI?: boolean;
  opportunityId?: string;
  showAISidebar?: boolean;
  onAISidebarToggle?: (open: boolean) => void;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  className,
  editorClassName,
  disabled = false,
  enableAI = false,
  opportunityId,
  showAISidebar: externalShowSidebar,
  onAISidebarToggle,
}: RichTextEditorProps) {
  const initialContentRef = useRef(content);
  const hasInitialized = useRef(false);

  // AI State
  const [internalShowSidebar, setInternalShowSidebar] = useState(false);
  const [showAIPromptDialog, setShowAIPromptDialog] = useState(false);
  const [slashCommandItems, setSlashCommandItems] = useState<SlashCommandItem[]>([]);
  const [slashCommandClientRect, setSlashCommandClientRect] = useState<(() => DOMRect | null) | null>(null);
  const slashCommandMenuRef = useRef<SlashCommandMenuRef | null>(null);

  // Use external or internal sidebar state
  const showSidebar = externalShowSidebar ?? internalShowSidebar;
  const setShowSidebar = onAISidebarToggle ?? setInternalShowSidebar;

  // AI Hook
  const {
    isLoading: isAILoading,
    streamingText,
    generateContent,
    improveText,
    expandText,
    shortenText,
    changeTone,
  } = useEditorAI({
    opportunityId,
    documentContext: content,
  });

  // Get slash commands with AI prompt handler
  const allSlashCommands = getSlashCommands(() => setShowAIPromptDialog(true));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 hover:underline dark:text-blue-400",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-muted-foreground before:pointer-events-none before:absolute before:top-4 before:left-4",
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse border border-border",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "border-b border-border",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class:
            "border border-border px-3 py-2 text-left font-semibold bg-muted/50",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-border px-3 py-2",
        },
      }),
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
        bulletListMarker: "-",
        breaks: false,
        tightLists: true,
        linkify: true,
      }),
      // Conditionally add slash command extension when AI is enabled
      ...(enableAI
        ? [
            SlashCommand.configure({
              suggestion: {
                items: ({ query }: { query: string }) => {
                  return filterSlashCommands(allSlashCommands, query);
                },
                render: () => {
                  return {
                    onStart: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
                      setSlashCommandItems(props.items);
                      setSlashCommandClientRect(() => props.clientRect ?? null);
                    },
                    onUpdate: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
                      setSlashCommandItems(props.items);
                      setSlashCommandClientRect(() => props.clientRect ?? null);
                    },
                    onKeyDown: (props: SuggestionKeyDownProps) => {
                      if (props.event.key === "Escape") {
                        setSlashCommandItems([]);
                        return true;
                      }
                      return slashCommandMenuRef.current?.onKeyDown({ event: props.event }) ?? false;
                    },
                    onExit: () => {
                      setSlashCommandItems([]);
                      setSlashCommandClientRect(null);
                    },
                  };
                },
              },
            }),
          ]
        : []),
    ],
    content: "", // Start empty, will set content in onCreate after parser is available
    editable: !disabled,
    onCreate: ({ editor }) => {
      // Parse markdown and set initial content after editor is ready
      if (!hasInitialized.current && initialContentRef.current) {
        const htmlContent = parseMarkdownToHtml(editor, initialContentRef.current);
        editor.commands.setContent(htmlContent);
        hasInitialized.current = true;
      }
    },
    onUpdate: ({ editor }) => {
      const markdown = getMarkdownContent(editor);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[200px] p-4",
          "prose-headings:mt-4 prose-headings:mb-2 prose-headings:first:mt-0",
          "prose-p:mb-3 prose-p:leading-relaxed",
          "prose-ul:list-disc prose-ul:list-inside prose-ul:mb-3 prose-ul:space-y-1 prose-ul:ml-2",
          "prose-ol:list-decimal prose-ol:list-inside prose-ol:mb-3 prose-ol:space-y-1 prose-ol:ml-2",
          "prose-li:ml-4",
          "prose-blockquote:border-l-4 prose-blockquote:border-muted prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-3 prose-blockquote:text-muted-foreground",
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono",
          "[&_table]:min-w-full [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:text-sm [&_table]:my-4",
          "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-muted/50",
          "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
          editorClassName
        ),
      },
    },
  });

  // Sync content when it changes externally (e.g., after generation)
  // Parse markdown to HTML before setting content so bullet points and formatting work correctly
  useEffect(() => {
    if (editor && content !== getMarkdownContent(editor)) {
      const htmlContent = parseMarkdownToHtml(editor, content);
      editor.commands.setContent(htmlContent);
    }
  }, [content, editor]);

  const addTable = useCallback(() => {
    editor
      ?.chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  // Handle AI bubble menu actions
  const handleAIAction = useCallback(
    async (action: AIAction, text: string, tone?: ToneOption) => {
      if (!editor) return;

      try {
        let result: string;

        switch (action) {
          case "improve":
            result = await improveText(text);
            break;
          case "expand":
            result = await expandText(text);
            break;
          case "shorten":
            result = await shortenText(text);
            break;
          case "tone":
            if (!tone) throw new Error("Tone is required for tone action");
            result = await changeTone(text, tone);
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        // Replace the selected text with the AI result
        const { from, to } = editor.state.selection;
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent(result)
          .run();

        toast.success("Text updated with AI");
      } catch (error) {
        console.error("AI action failed:", error);
        toast.error(
          error instanceof Error ? error.message : "AI action failed"
        );
      }
    },
    [editor, improveText, expandText, shortenText, changeTone]
  );

  // Handle AI prompt generation
  const handleAIGenerate = useCallback(
    async (prompt: string) => {
      if (!editor) return;

      try {
        const result = await generateContent(prompt);

        // Insert the generated content at cursor position
        editor.chain().focus().insertContent(result).run();

        toast.success("Content generated");
      } catch (error) {
        console.error("AI generation failed:", error);
        toast.error(
          error instanceof Error ? error.message : "AI generation failed"
        );
      }
    },
    [editor, generateContent]
  );

  // Handle inserting text from AI sidebar
  const handleInsertFromSidebar = useCallback(
    (text: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(text).run();
    },
    [editor]
  );

  // Handle slash command selection
  const handleSlashCommand = useCallback(
    (item: SlashCommandItem) => {
      if (!editor) return;

      const { from, to } = editor.state.selection;
      // Delete the slash and query text
      const range = { from: from - 1, to }; // -1 to include the "/"

      item.command({ editor, range });
      setSlashCommandItems([]);
    },
    [editor]
  );

  if (!editor) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("rounded-md border bg-background", className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b p-2 bg-muted/30">
          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            tooltip="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            tooltip="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            tooltip="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            tooltip="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Headings */}
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            tooltip="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            tooltip="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            tooltip="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            tooltip="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            tooltip="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            tooltip="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Link */}
          <ToolbarButton
            onClick={setLink}
            active={editor.isActive("link")}
            tooltip="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>

          {/* Table */}
          <ToolbarButton onClick={addTable} tooltip="Insert Table">
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Undo/Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            tooltip="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            tooltip="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>

          {/* AI Toggle - only shown when AI is enabled */}
          {enableAI && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <AISidebarToggle
                isOpen={showSidebar}
                onClick={() => setShowSidebar(!showSidebar)}
              />
            </>
          )}
        </div>

        {/* Table Controls - shown when cursor is in a table */}
        {editor.isActive("table") && (
          <div className="flex flex-wrap items-center gap-1 border-b p-2 bg-blue-50 dark:bg-blue-950/30">
            <span className="text-xs text-muted-foreground mr-2">Table:</span>
            <ToolbarButton
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              tooltip="Add Column Before"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1" />
              Col Before
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              tooltip="Add Column After"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1" />
              Col After
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().deleteColumn().run()}
              tooltip="Delete Column"
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Col
            </ToolbarButton>
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarButton
              onClick={() => editor.chain().focus().addRowBefore().run()}
              tooltip="Add Row Before"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1" />
              Row Before
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().addRowAfter().run()}
              tooltip="Add Row After"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1" />
              Row After
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().deleteRow().run()}
              tooltip="Delete Row"
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Row
            </ToolbarButton>
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarButton
              onClick={() => editor.chain().focus().deleteTable().run()}
              tooltip="Delete Table"
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Table
            </ToolbarButton>
          </div>
        )}

        {/* Editor Content with AI Features */}
        <div className="flex">
          <div className="flex-1 relative">
            <EditorContent editor={editor} />

            {/* AI Features - only rendered when AI is enabled */}
            {enableAI && (
              <>
                {/* Bubble Menu for text selection */}
                <EditorBubbleMenu
                  editor={editor}
                  onAIAction={handleAIAction}
                  isAILoading={isAILoading}
                />

                {/* Plus Button Menu for empty lines */}
                <PlusButtonMenu
                  editor={editor}
                  onAIPrompt={() => setShowAIPromptDialog(true)}
                />

                {/* Slash Command Menu (rendered via portal) */}
                {slashCommandItems.length > 0 &&
                  slashCommandClientRect &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <div
                      style={{
                        position: "fixed",
                        top: (slashCommandClientRect()?.bottom ?? 0) + 8,
                        left: slashCommandClientRect()?.left ?? 0,
                        zIndex: 50,
                      }}
                    >
                      <SlashCommandMenu
                        ref={slashCommandMenuRef}
                        items={slashCommandItems}
                        command={handleSlashCommand}
                      />
                    </div>,
                    document.body
                  )}

                {/* AI Prompt Dialog */}
                <AIPromptDialog
                  open={showAIPromptDialog}
                  onOpenChange={setShowAIPromptDialog}
                  onGenerate={handleAIGenerate}
                  isLoading={isAILoading}
                />
              </>
            )}
          </div>

          {/* AI Sidebar */}
          {enableAI && showSidebar && (
            <AISidebar
              isOpen={showSidebar}
              onClose={() => setShowSidebar(false)}
              opportunityId={opportunityId}
              documentContent={content}
              onInsertText={handleInsertFromSidebar}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
  children: React.ReactNode;
  size?: "default" | "sm";
  variant?: "default" | "destructive";
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  tooltip,
  children,
  size = "default",
  variant = "default",
}: ToolbarButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        size === "sm" && "h-6 px-2 text-xs",
        size === "default" && "h-8 w-8 p-0",
        active && "bg-accent text-accent-foreground",
        variant === "destructive" && "text-destructive hover:text-destructive hover:bg-destructive/10"
      )}
    >
      {children}
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
