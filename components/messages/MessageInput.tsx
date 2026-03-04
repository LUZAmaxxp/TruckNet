"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RecordButton } from "@/components/voice/RecordButton";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSendText: (content: string) => Promise<void> | void;
  onSendVoice: (blob: Blob, durationSeconds: number) => Promise<void> | void;
  disabled?: boolean;
}

export function MessageInput({ onSendText, onSendVoice, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendPressed, setSendPressed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea — max 4 rows (~96px)
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitText();
    }
  }

  const submitText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSendPressed(true);
    setSending(true);
    try {
      await onSendText(trimmed);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
      setTimeout(() => setSendPressed(false), 300);
    }
  }, [text, sending, disabled, onSendText]);

  return (
    <div
      className="flex items-end gap-2 px-4 py-3"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {/* Voice record button */}
      <div className="shrink-0">
        <RecordButton
          onRecordingComplete={async (blob, duration) => {
            if (!disabled) await onSendVoice(blob, duration);
          }}
        />
      </div>

      {/* Text input */}
      <div className="flex-1">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled || sending}
          rows={1}
          className={cn(
            "transition-shadow duration-200",
            "focus-visible:shadow-[0_0_0_3px_rgba(28,58,94,0.07)]"
          )}
          style={{ background: "var(--base)" }}
          aria-label="Message text input"
        />
      </div>

      {/* Send button */}
      <motion.div
        className="shrink-0"
        animate={sendPressed ? { scale: [1, 0.88, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <Button
          variant="primary"
          size="icon"
          onClick={() => void submitText()}
          disabled={!text.trim() || sending || disabled}
          aria-label="Send message"
          className="h-10 w-10 rounded-full"
        >
          <Send className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}
