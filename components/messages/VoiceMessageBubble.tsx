"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  VoiceMessageItem,
  type VoiceMessageData,
} from "@/components/voice/VoiceMessageItem";

interface VoiceMessageBubbleProps {
  message: VoiceMessageData;
  variant: "sent" | "received";
  onListened?: (id: string) => void;
}

export const VoiceMessageBubble = React.memo(function VoiceMessageBubble({
  message,
  variant,
  onListened,
}: VoiceMessageBubbleProps) {
  const isSent = variant === "sent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className={cn(
        "flex w-full",
        isSent ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn("max-w-[75%]", isSent ? "opacity-90" : "")}>
        <VoiceMessageItem message={message} onListened={onListened} />
      </div>
    </motion.div>
  );
});
