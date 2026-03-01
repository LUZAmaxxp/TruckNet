"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TextMessageData {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  status: "delivered" | "read";
  createdAt: string | Date;
}

interface MessageBubbleProps {
  message: TextMessageData;
  variant: "sent" | "received";
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  variant,
}: MessageBubbleProps) {
  const isSent = variant === "sent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className={cn("flex w-full", isSent ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isSent
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isSent ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
});
