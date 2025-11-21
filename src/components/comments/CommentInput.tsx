// src/components/comments/CommentInput.tsx
// Input component for creating/editing comments with @mention support

"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface CommentInputProps {
  placeholder?: string;
  onSubmit: (content: string, mentionedUserIds: string[]) => Promise<void>;
  initialValue?: string;
  initialMentions?: string[];
  availableUsers: User[];
  autoFocus?: boolean;
  submitButtonText?: string;
}

export function CommentInput({
  placeholder = "Add a comment... Use @ to mention someone",
  onSubmit,
  initialValue = "",
  initialMentions = [],
  availableUsers,
  autoFocus = false,
  submitButtonText = "Comment",
}: CommentInputProps) {
  const [content, setContent] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter users based on mention query
  const filteredUsers = availableUsers.filter((user) => {
    const query = mentionQuery.toLowerCase();
    const name = user.name?.toLowerCase() || "";
    const email = user.email.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  // Extract mentioned user IDs from content
  const extractMentionedUserIds = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = text.matchAll(mentionRegex);
    const userIds: string[] = [];

    for (const match of matches) {
      const userId = match[2];
      if (userId && !userIds.includes(userId)) {
        userIds.push(userId);
      }
    }

    return userIds;
  };

  // Handle input change and detect @mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;

    setContent(value);

    // Detect @ mention trigger
    const textBeforeCursor = value.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionStartPos(cursor - mentionMatch[0].length);
      setShowMentions(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention into text
  const insertMention = (user: User) => {
    const beforeMention = content.slice(0, mentionStartPos);
    const afterCursor = content.slice(textareaRef.current?.selectionStart || 0);

    // Format: @[Display Name](userId)
    const mentionText = `@[${user.name || user.email}](${user.id})`;
    const newContent = `${beforeMention}${mentionText} ${afterCursor}`;

    setContent(newContent);
    setShowMentions(false);

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPos = beforeMention.length + mentionText.length + 1;
      setTimeout(() => {
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Handle keyboard navigation in mention popover
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions) {
      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    // Navigate mentions with arrow keys
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedMentionIndex((prev) =>
        prev < filteredUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (filteredUsers[selectedMentionIndex]) {
        insertMention(filteredUsers[selectedMentionIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowMentions(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const mentionedUserIds = extractMentionedUserIds(content);
      await onSubmit(content, mentionedUserIds);
      setContent("");
      toast.success("Comment added");
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  return (
    <div className="space-y-2">
      <Popover open={showMentions} onOpenChange={setShowMentions}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[80px] max-h-[300px] resize-none pr-10"
              autoFocus={autoFocus}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-2"
          align="start"
          side="top"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="text-xs text-muted-foreground mb-2">
            Mention someone
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No users found
              </div>
            ) : (
              filteredUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                    index === selectedMentionIndex
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {user.name || user.email}
                    </div>
                    {user.name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Tip: Use @ to mention, <kbd className="px-1 rounded bg-muted">Cmd+Enter</kbd> to submit
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          size="sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {submitButtonText}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
