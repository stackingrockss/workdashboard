"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, X, Check, Loader2, Sparkles, Eye, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

interface InlineMarkdownWithAIProps {
  label: string;
  value: string | null | undefined;
  onSave: (value: string | null) => Promise<void>;
  placeholder?: string;
  className?: string;
  rows?: number;
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  generateButtonLabel?: string;
  /** Use rich text WYSIWYG editor instead of markdown textarea */
  useRichTextEditor?: boolean;
  /** Opportunity ID for AI context (required when enableAI is true) */
  opportunityId?: string;
  /** Enable AI features in the rich text editor */
  enableAI?: boolean;
}

export function InlineMarkdownWithAI({
  value,
  onSave,
  label,
  placeholder = "Click to edit",
  className,
  rows = 8,
  onGenerate,
  isGenerating = false,
  generateButtonLabel = "Generate with Gemini",
  useRichTextEditor = false,
  opportunityId,
  enableAI = false,
}: InlineMarkdownWithAIProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync editValue with value prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value?.toString() || "");
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current && previewMode === "edit") {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing, previewMode]);

  const handleSave = async () => {
    if (editValue === (value?.toString() || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue || null);
      setIsEditing(false);
      setPreviewMode("edit"); // Reset to edit mode for next time
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || "");
    setIsEditing(false);
    setPreviewMode("edit"); // Reset to edit mode
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    // Ctrl/Cmd + Enter to save
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  // Show generate button only if field is empty and onGenerate is provided
  const showGenerateButton = onGenerate && (!value || value.toString().trim().length === 0);

  // Markdown renderer component
  const MarkdownContent = ({ content }: { content: string }) => (
    <div className="markdown-content prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 ml-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">{children}</ol>,
          li: ({ children }) => <li className="ml-4">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted pl-4 italic my-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-3 text-sm">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  if (!isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 cursor-pointer transition-colors group",
          isHovered && "border-primary/50 bg-accent/50",
          className
        )}
        onClick={() => !isGenerating && setIsEditing(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="flex items-center gap-2">
            {showGenerateButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerate?.();
                }}
                disabled={isGenerating}
                className="h-7 text-xs"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    {generateButtonLabel}
                  </>
                )}
              </Button>
            )}
            {!showGenerateButton && (
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
        {value && value.toString().trim().length > 0 ? (
          <MarkdownContent content={value.toString()} />
        ) : (
          <div className="text-muted-foreground italic text-sm">{placeholder}</div>
        )}
      </div>
    );
  }

  // Rich text editor mode - no tabs needed, edit directly in WYSIWYG
  if (useRichTextEditor) {
    return (
      <div className={cn("rounded-lg border p-4 border-primary", className)}>
        {label && (
          <div className="text-sm font-medium text-muted-foreground mb-3">{label}</div>
        )}

        <RichTextEditor
          content={editValue}
          onChange={setEditValue}
          placeholder={placeholder}
          disabled={isSaving}
          className="min-h-[300px]"
          editorClassName="min-h-[300px]"
          enableAI={enableAI}
          opportunityId={opportunityId}
        />

        <div className="flex items-center justify-end gap-2 mt-3">
          <span className="text-xs text-muted-foreground mr-auto">
            Edit directly above - formatting is applied automatically
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Markdown textarea mode with Edit/Preview tabs
  return (
    <div className={cn("rounded-lg border p-4 border-primary", className)}>
      <div className="text-sm font-medium text-muted-foreground mb-3">{label}</div>

      <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as "edit" | "preview")}>
        <TabsList className="mb-3 w-full grid grid-cols-2">
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <Code className="h-3 w-3" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-3 w-3" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-0">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder={placeholder}
            rows={rows}
            className="resize-none font-mono text-sm"
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div
            className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-md border bg-background p-4"
            style={{ height: `${rows * 24}px` }}
          >
            {editValue.trim().length > 0 ? (
              <MarkdownContent content={editValue} />
            ) : (
              <div className="text-muted-foreground italic text-sm">{placeholder}</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-xs text-muted-foreground mr-auto">
          Ctrl+Enter to save, Esc to cancel
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
