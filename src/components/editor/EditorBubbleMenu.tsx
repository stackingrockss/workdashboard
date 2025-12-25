"use client";

import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Sparkles,
  Wand2,
  Expand,
  Shrink,
  MessageSquare,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIAction, ToneOption } from "@/types/editor";

interface EditorBubbleMenuProps {
  editor: Editor;
  onAIAction: (
    action: AIAction,
    text: string,
    tone?: ToneOption
  ) => Promise<void>;
  isAILoading?: boolean;
}

/**
 * Bubble menu that appears on text selection
 * Provides formatting options and AI writing actions
 */
export function EditorBubbleMenu({
  editor,
  onAIAction,
  isAILoading = false,
}: EditorBubbleMenuProps) {
  const [isAIMenuOpen, setIsAIMenuOpen] = useState(false);

  const handleAIAction = async (action: AIAction, tone?: ToneOption) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    if (!selectedText.trim()) return;

    setIsAIMenuOpen(false);
    await onAIAction(action, selectedText, tone);
  };

  const handleSetLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <BubbleMenu
        editor={editor}
        options={{
          placement: "top",
        }}
        shouldShow={({ editor: ed }) => {
          // Don't show when selecting within code blocks
          if (ed.isActive("codeBlock")) return false;
          return true;
        }}
        className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
      >
        {/* Text Formatting */}
        <FormatButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          tooltip="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </FormatButton>

        <FormatButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          tooltip="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </FormatButton>

        <FormatButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          tooltip="Underline (Ctrl+U)"
        >
          <Underline className="h-4 w-4" />
        </FormatButton>

        <FormatButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          tooltip="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </FormatButton>

        <FormatButton
          onClick={handleSetLink}
          active={editor.isActive("link")}
          tooltip="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </FormatButton>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-border" />

        {/* AI Actions Dropdown */}
        <DropdownMenu open={isAIMenuOpen} onOpenChange={setIsAIMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1 px-2 text-sm font-medium",
                    isAILoading && "pointer-events-none opacity-70"
                  )}
                  disabled={isAILoading}
                >
                  {isAILoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">AI</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">AI Writing Actions</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => handleAIAction("improve")}>
              <Wand2 className="mr-2 h-4 w-4" />
              Improve writing
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleAIAction("expand")}>
              <Expand className="mr-2 h-4 w-4" />
              Make longer
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleAIAction("shorten")}>
              <Shrink className="mr-2 h-4 w-4" />
              Make shorter
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Tone submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MessageSquare className="mr-2 h-4 w-4" />
                Change tone
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => handleAIAction("tone", "professional")}
                >
                  Professional
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAIAction("tone", "casual")}
                >
                  Casual
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAIAction("tone", "friendly")}
                >
                  Friendly
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAIAction("tone", "executive")}
                >
                  Executive
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </BubbleMenu>
    </TooltipProvider>
  );
}

/**
 * Individual format button with tooltip
 */
interface FormatButtonProps {
  onClick: () => void;
  active?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function FormatButton({
  onClick,
  active = false,
  tooltip,
  children,
}: FormatButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn(
            "h-8 w-8 p-0",
            active && "bg-accent text-accent-foreground"
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
