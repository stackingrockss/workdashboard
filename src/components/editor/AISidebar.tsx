"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Send,
  Sparkles,
  FileText,
  AlertCircle,
  Lightbulb,
  ListChecks,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorAIChat, AIEditorChatMessage } from "@/hooks/useEditorAI";
import { RichTextViewer } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId?: string;
  documentContent?: string;
  onInsertText?: (text: string) => void;
}

/**
 * Quick action definition
 */
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "summarize",
    label: "Summarize",
    icon: <FileText className="h-4 w-4" />,
    prompt:
      "Summarize this document in 2-3 concise paragraphs, highlighting the key points.",
  },
  {
    id: "improve",
    label: "Suggest improvements",
    icon: <Lightbulb className="h-4 w-4" />,
    prompt:
      "Review this document and suggest 3-5 specific improvements to make it more compelling and effective.",
  },
  {
    id: "action-items",
    label: "Extract action items",
    icon: <ListChecks className="h-4 w-4" />,
    prompt:
      "Extract all action items and next steps from this document as a bullet list.",
  },
  {
    id: "issues",
    label: "Find issues",
    icon: <AlertCircle className="h-4 w-4" />,
    prompt:
      "Identify any gaps, inconsistencies, or potential issues in this document that should be addressed.",
  },
];

/**
 * AI Sidebar component
 * Collapsible panel for AI chat and quick actions
 */
export function AISidebar({
  isOpen,
  onClose,
  opportunityId,
  documentContent,
  onInsertText,
}: AISidebarProps) {
  const [inputValue, setInputValue] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
  } = useEditorAIChat({
    opportunityId,
    documentContent,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue;
    setInputValue("");
    await sendMessage(message);
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      await sendMessage(action.prompt);
    },
    [sendMessage]
  );

  const handleCopyMessage = useCallback(
    async (message: AIEditorChatMessage) => {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopiedMessageId(message.id);
        setTimeout(() => setCopiedMessageId(null), 2000);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy");
      }
    },
    []
  );

  const handleInsertMessage = useCallback(
    (message: AIEditorChatMessage) => {
      onInsertText?.(message.content);
      toast.success("Inserted into document");
    },
    [onInsertText]
  );

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex h-full w-80 flex-col border-l bg-background transition-all duration-200",
        "animate-in slide-in-from-right-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="border-b p-4">
          <p className="mb-3 text-sm text-muted-foreground">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-1 py-2 text-xs"
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Ask AI anything about this document
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              I can help you write, edit, and improve your content
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "group relative rounded-lg p-3",
                  message.role === "user"
                    ? "bg-primary/10 ml-4"
                    : "bg-muted mr-4"
                )}
              >
                {/* Message content */}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {message.role === "assistant" ? (
                    <RichTextViewer content={message.content || "..."} />
                  ) : (
                    <p className="m-0">{message.content}</p>
                  )}
                </div>

                {/* Actions for assistant messages */}
                {message.role === "assistant" && message.content && (
                  <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleCopyMessage(message)}
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : (
                        <Copy className="mr-1 h-3 w-3" />
                      )}
                      Copy
                    </Button>
                    {onInsertText && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleInsertMessage(message)}
                      >
                        <ChevronLeft className="mr-1 h-3 w-3" />
                        Insert
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
                <Button
                  variant="link"
                  size="sm"
                  className="ml-2 h-auto p-0 text-destructive"
                  onClick={clearError}
                >
                  Dismiss
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 w-full text-xs text-muted-foreground"
            onClick={clearMessages}
          >
            Clear conversation
          </Button>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Toggle button for the AI sidebar
 */
interface AISidebarToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

export function AISidebarToggle({ isOpen, onClick }: AISidebarToggleProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "gap-2",
        isOpen && "bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800"
      )}
    >
      <Sparkles className={cn("h-4 w-4", isOpen && "text-purple-500")} />
      AI
      {isOpen ? (
        <ChevronRight className="h-3 w-3" />
      ) : (
        <ChevronLeft className="h-3 w-3" />
      )}
    </Button>
  );
}
