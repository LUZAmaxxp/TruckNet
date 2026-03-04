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
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
            {recipient.avatar ? (
              <img src={recipient.avatar} alt={recipient.name} className="h-full w-full object-cover" />
            ) : (
              recipient.name[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Message {recipient.name}</p>
            <p className="text-xs text-gray-500">Sent as admin · visible in their messages</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
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
          className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
        />

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs ${remaining < 50 ? "text-yellow-400" : "text-gray-500"}`}>
            {remaining} characters remaining
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">⌘ Enter to send</p>
      </div>
    </>
  );
}
