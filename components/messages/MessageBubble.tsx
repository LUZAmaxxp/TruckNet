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
        className="max-w-[70%] px-4 py-2"
        style={
          isSent
            ? {
                background: "var(--navy)",
                color: "rgba(255,255,255,0.95)",
                borderRadius: "14px 14px 4px 14px",
                boxShadow: "0 2px 8px rgba(28,58,94,0.25)",
              }
            : {
                background: "var(--surface)",
                color: "var(--ink)",
                border: "1px solid var(--hairline)",
                borderRadius: "14px 14px 14px 4px",
                boxShadow: "var(--shadow-xs)",
              }
        }
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed text-[14px]">
          {message.content}
        </p>
        <p
          className="mt-1 text-right font-mono text-[10px]"
          style={{ color: isSent ? "rgba(255,255,255,0.55)" : "var(--subtle)" }}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
});
