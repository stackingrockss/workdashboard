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
import { useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  className,
  editorClassName,
  disabled = false,
}: RichTextEditorProps) {
  const initialContentRef = useRef(content);
  const hasInitialized = useRef(false);

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

        {/* Editor Content */}
        <EditorContent editor={editor} />
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
