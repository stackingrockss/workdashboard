"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatFABProps {
  onClick: () => void;
}

export function ChatFAB({ onClick }: ChatFABProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
      aria-label="Open AI Chat"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
}
