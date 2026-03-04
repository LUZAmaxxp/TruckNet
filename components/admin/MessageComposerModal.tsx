"use client";

import { useRef, useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";

const MAX_CHARS = 500;

interface MessageComposerModalProps {
  recipient: {
    id: string;
    name: string;
    avatar: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MessageComposerModal — modal dialog for admin-to-driver direct messages.
 * Calls POST /api/text-messages with { receiverId, content }.
 */
export function MessageComposerModal({
  recipient,
  isOpen,
  onClose,
}: MessageComposerModalProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      setContent("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!isOpen) return null;

  const remaining = MAX_CHARS - content.length;
  const canSend = content.trim().length > 0 && remaining >= 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch("/api/text-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: recipient.id, content: content.trim() }),
      });
      if (!res.ok) {
        const err: { error?: string } = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to send message");
        return;
      }
      toast.success(`Message sent to ${recipient.name}`);
      onClose();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSend();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        style={{ background: "rgba(28,58,94,0.4)" }}
        onClick={onClose}
      />

      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-5"
        style={{
          borderRadius: "var(--radius-2xl)",
          border: "1px solid var(--hairline)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="h-9 w-9 overflow-hidden rounded-full flex items-center justify-center font-display text-[13px] font-bold shrink-0"
            style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
          >
            {recipient.avatar ? (
              <img src={recipient.avatar} alt={recipient.name} className="h-full w-full object-cover" />
            ) : (
              recipient.name[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Message {recipient.name}</p>
            <p className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>Sent as admin · visible in their messages</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-[8px] p-1.5 transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hairline-2)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message…"
          maxLength={MAX_CHARS}
          rows={4}
          className="w-full resize-none p-3 font-body text-[13px] focus:outline-none transition-colors"
          style={{
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid var(--hairline)",
            background: "var(--base)",
            color: "var(--ink)",
          }}
        />

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span
            className="font-mono text-[10px]"
            style={{ color: remaining < 50 ? "var(--honey)" : "var(--subtle)" }}
          >
            {remaining} characters remaining
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-[8px] px-3 py-2 font-body text-[12px] font-semibold transition-colors"
              style={{ color: "var(--muted)", border: "1px solid var(--hairline)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 font-body text-[12px] font-semibold disabled:opacity-40 transition-colors"
              style={{ background: "var(--navy)", color: "white" }}
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        <p className="font-mono text-[10px] mt-2" style={{ color: "var(--subtle)" }}>⌘ Enter to send</p>
      </div>
    </>
  );
}
