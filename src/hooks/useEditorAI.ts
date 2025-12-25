"use client";

import { useState, useCallback, useRef } from "react";
import { AIAction, ToneOption, UseEditorAIReturn } from "@/types/editor";

interface UseEditorAIOptions {
  opportunityId?: string;
  documentContext?: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
}

/**
 * Hook for AI writing operations in the editor
 *
 * Provides streaming AI generation, text improvement, expansion, shortening,
 * and tone changing capabilities.
 */
export function useEditorAI(options: UseEditorAIOptions = {}): UseEditorAIReturn {
  const { opportunityId, documentContext, onStreamStart, onStreamEnd } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Execute an AI action with streaming response
   */
  const executeAction = useCallback(
    async (
      action: AIAction,
      text?: string,
      prompt?: string,
      tone?: ToneOption
    ): Promise<string> => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);
      setStreamingText("");
      onStreamStart?.();

      try {
        const response = await fetch("/api/v1/editor/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            text,
            prompt,
            tone,
            opportunityId,
            documentContext,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }

        setIsLoading(false);
        onStreamEnd?.();
        return fullText;
      } catch (err) {
        // Don't treat abort as an error
        if (err instanceof Error && err.name === "AbortError") {
          setIsLoading(false);
          onStreamEnd?.();
          return streamingText;
        }

        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        setIsLoading(false);
        onStreamEnd?.();
        throw err;
      }
    },
    [opportunityId, documentContext, onStreamStart, onStreamEnd, streamingText]
  );

  /**
   * Generate content from a prompt
   */
  const generateContent = useCallback(
    async (prompt: string): Promise<string> => {
      return executeAction("generate", undefined, prompt);
    },
    [executeAction]
  );

  /**
   * Improve text (grammar, clarity, flow)
   */
  const improveText = useCallback(
    async (text: string): Promise<string> => {
      return executeAction("improve", text);
    },
    [executeAction]
  );

  /**
   * Expand text with more detail
   */
  const expandText = useCallback(
    async (text: string): Promise<string> => {
      return executeAction("expand", text);
    },
    [executeAction]
  );

  /**
   * Shorten text to key points
   */
  const shortenText = useCallback(
    async (text: string): Promise<string> => {
      return executeAction("shorten", text);
    },
    [executeAction]
  );

  /**
   * Change text tone
   */
  const changeTone = useCallback(
    async (text: string, tone: ToneOption): Promise<string> => {
      return executeAction("tone", text, undefined, tone);
    },
    [executeAction]
  );

  /**
   * Cancel the current generation
   */
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    streamingText,
    generateContent,
    improveText,
    expandText,
    shortenText,
    changeTone,
    cancelGeneration,
    clearError,
  };
}

/**
 * Hook for AI sidebar chat functionality
 */
export interface AIEditorChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseEditorAIChatOptions {
  opportunityId?: string;
  documentContent?: string;
}

interface UseEditorAIChatReturn {
  messages: AIEditorChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

export function useEditorAIChat(
  options: UseEditorAIChatOptions = {}
): UseEditorAIChatReturn {
  const { opportunityId, documentContent } = options;

  const [messages, setMessages] = useState<AIEditorChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const userMessage: AIEditorChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
      };

      const assistantMessage: AIEditorChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setError(null);

      try {
        // Build history for context
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/v1/editor/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "generate",
            prompt: message,
            opportunityId,
            documentContext: documentContent,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          // Update assistant message with streaming content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: fullText } : m
            )
          );
        }

        setIsLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsLoading(false);
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        setIsLoading(false);

        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMessage.id)
        );
      }
    },
    [messages, opportunityId, documentContent]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
  };
}
