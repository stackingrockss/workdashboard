"use client";

import { Editor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlusButtonMenuProps {
  editor: Editor;
  onAIPrompt?: () => void;
}

/**
 * Plus button floating menu that appears on empty lines
 * Provides quick access to block types and AI generation
 */
export function PlusButtonMenu({ editor, onAIPrompt }: PlusButtonMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const insertHeading = (level: 1 | 2 | 3) => {
    editor.chain().focus().setHeading({ level }).run();
    setIsOpen(false);
  };

  const insertBulletList = () => {
    editor.chain().focus().toggleBulletList().run();
    setIsOpen(false);
  };

  const insertOrderedList = () => {
    editor.chain().focus().toggleOrderedList().run();
    setIsOpen(false);
  };

  const insertQuote = () => {
    editor.chain().focus().toggleBlockquote().run();
    setIsOpen(false);
  };

  const insertDivider = () => {
    editor.chain().focus().setHorizontalRule().run();
    setIsOpen(false);
  };

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
    setIsOpen(false);
  };

  const insertCodeBlock = () => {
    editor.chain().focus().toggleCodeBlock().run();
    setIsOpen(false);
  };

  const handleAIPrompt = () => {
    setIsOpen(false);
    onAIPrompt?.();
  };

  return (
    <FloatingMenu
      editor={editor}
      options={{
        placement: "left-start",
        offset: { mainAxis: 8 },
      }}
      shouldShow={({ state }) => {
        const { $from } = state.selection;
        const parent = $from.parent;

        // Only show on paragraph nodes
        if (parent.type.name !== "paragraph") {
          return false;
        }

        // Show if the paragraph is empty (no content at all)
        const isEmptyParagraph = parent.content.size === 0;

        // Also show if cursor is at the very start of an empty text node
        // (handles case where paragraph has an empty text node)
        const isAtStartOfEmptyLine =
          $from.parentOffset === 0 && parent.textContent === "";

        return isEmptyParagraph || isAtStartOfEmptyLine;
      }}
      className="flex items-center"
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 rounded-full p-0 opacity-50 transition-opacity",
              "hover:opacity-100 hover:bg-accent",
              isOpen && "opacity-100 bg-accent"
            )}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="bottom" className="w-52">
          {/* AI Section */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            AI
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleAIPrompt}>
            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
            Write with AI
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Formatting Section */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Headings
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => insertHeading(1)}>
            <Heading1 className="mr-2 h-4 w-4" />
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(2)}>
            <Heading2 className="mr-2 h-4 w-4" />
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(3)}>
            <Heading3 className="mr-2 h-4 w-4" />
            Heading 3
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Blocks Section */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Blocks
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={insertBulletList}>
            <List className="mr-2 h-4 w-4" />
            Bullet List
          </DropdownMenuItem>
          <DropdownMenuItem onClick={insertOrderedList}>
            <ListOrdered className="mr-2 h-4 w-4" />
            Numbered List
          </DropdownMenuItem>
          <DropdownMenuItem onClick={insertQuote}>
            <Quote className="mr-2 h-4 w-4" />
            Quote
          </DropdownMenuItem>
          <DropdownMenuItem onClick={insertDivider}>
            <Minus className="mr-2 h-4 w-4" />
            Divider
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Advanced Section */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Advanced
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={insertTable}>
            <Table className="mr-2 h-4 w-4" />
            Table
          </DropdownMenuItem>
          <DropdownMenuItem onClick={insertCodeBlock}>
            <Code className="mr-2 h-4 w-4" />
            Code Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </FloatingMenu>
  );
}
