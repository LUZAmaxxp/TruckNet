"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { AdminMessageBubble } from "@/components/admin/AdminMessageBubble";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  status: string;
  createdAt: Date | string;
}

interface AdminConversationThreadProps {
  driverId: string;
  driverName: string;
  driverAvatar?: string | null;
}

/**
 * AdminConversationThread — full conversation history between admin and a given driver.
 * Subscribes to real-time text_message_received events to append incoming messages.
 */
export function AdminConversationThread({
  driverId,
  driverName,
  driverAvatar,
}: AdminConversationThreadProps) {
  const { data: session } = useSession();
  const { on } = useSocket();
  const adminId = session?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/text-messages?friendId=${driverId}`);
      if (res.ok) {
        const data = (await res.json()) as { messages: Message[] };
        setMessages(data.messages);
      }
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time incoming messages — only append from the currently viewed driver
  useEffect(() => {
    const handler = (msg: {
      id: string;
      senderId: string;
      senderName: string;
      content: string;
      createdAt: Date | string;
    }) => {
      if (msg.senderId !== driverId) return; // ignore messages from other drivers
      setMessages((prev) => [
        ...prev,
        { ...msg, status: "delivered" },
      ]);
    };
    const unsub = on("text_message_received", handler);
    return unsub;
  }, [on, driverId]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/text-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: driverId, content }),
      });
      if (res.ok) {
        const msg = (await res.json()) as Message & { senderName?: string };
        setMessages((prev) => [
          ...prev,
          {
            ...msg,
            senderId: adminId ?? "",
            senderName: session?.user?.name ?? "Admin",
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
          {driverAvatar ? (
            <img src={driverAvatar} alt={driverName} className="h-full w-full object-cover" />
          ) : (
            driverName[0]?.toUpperCase()
          )}
        </div>
        <p className="font-semibold text-white">{driverName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <AdminMessageBubble
              key={msg.id}
              content={msg.content}
              sentAt={msg.createdAt}
              isSelf={msg.senderId === adminId}
              senderName={msg.senderName}
              senderAvatar={msg.senderId === driverId ? driverAvatar : undefined}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (⌘Enter to send)"
            className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || sending}
            className="rounded-xl bg-blue-600 p-2.5 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
