"use client";

import { useState } from "react";
import { ChatFAB } from "./chat-fab";
import { ChatModal } from "./chat-modal";

interface ChatWidgetProps {
  entityType: "opportunity" | "account";
  entityId: string;
  entityName: string;
}

export function ChatWidget({ entityType, entityId, entityName }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ChatFAB onClick={() => setIsOpen(true)} />
      <ChatModal
        open={isOpen}
        onOpenChange={setIsOpen}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
      />
    </>
  );
}
