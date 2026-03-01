"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble, type TextMessageData } from "@/components/messages/MessageBubble";
import { VoiceMessageBubble } from "@/components/messages/VoiceMessageBubble";
import { MessageInput } from "@/components/messages/MessageInput";
import type { VoiceMessageData } from "@/components/voice/VoiceMessageItem";
import { useSocket } from "@/hooks/useSocket";

export interface Friend {
  id: string;
  name: string;
  tag: string;
  profileImageUrl?: string | null;
}

type CombinedMessage =
  | { kind: "text"; data: TextMessageData; sortKey: number }
  | { kind: "voice"; data: VoiceMessageData; sortKey: number };

interface ChatPanelProps {
  friend: Friend;
  currentUserId: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ChatPanel({
  friend,
  currentUserId,
  onBack,
  showBackButton,
}: ChatPanelProps) {
  const [textMessages, setTextMessages] = useState<TextMessageData[]>([]);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { on } = useSocket();

  // ── Fetch full conversation on mount / friend change ──────────────────────
  useEffect(() => {
    setLoading(true);
    setTextMessages([]);
    setVoiceMessages([]);

    async function fetchConversation() {
      const [textRes, voiceRes] = await Promise.all([
        fetch(`/api/text-messages?friendId=${friend.id}`),
        fetch("/api/voice-messages"),
      ]);

      if (textRes.ok) {
        const { messages } = (await textRes.json()) as { messages: TextMessageData[] };
        setTextMessages(messages);

        // Mark all delivered messages from this friend as read
        const unread = messages.filter(
          (m) => m.senderId === friend.id && m.status === "delivered"
        );
        for (const m of unread) {
          void fetch(`/api/text-messages/${m.id}/read`, { method: "PATCH" });
        }
      }

      if (voiceRes.ok) {
        const { messages } = (await voiceRes.json()) as { messages: VoiceMessageData[] };
        // Filter conversation: messages between this pair only
        setVoiceMessages(
          messages.filter(
            (m) =>
              m.senderId === friend.id ||
              // The GET endpoint already returns inbox; also slot in sent ones
              (m.senderId === currentUserId)
          )
        );
      }

      setLoading(false);
    }

    void fetchConversation();
  }, [friend.id, currentUserId]);

  // ── Real-time: text messages ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = on("text_message_received", (msg) => {
      console.log("[ChatPanel] text_message_received", msg);
      if (msg.senderId !== friend.id) return; // not our conversation
      const newMsg: TextMessageData = {
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        status: "delivered",
        createdAt: msg.createdAt,
      };
      setTextMessages((prev) => [...prev, newMsg]);
      // Auto-mark as read since this panel is open
      void fetch(`/api/text-messages/${msg.id}/read`, { method: "PATCH" });
    });
    return () => unsub?.();
  }, [on, friend.id]);

  // ── Real-time: voice messages ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = on("voice_message_received", (msg) => {
      console.log("[ChatPanel] voice_message_received", msg);
      if (msg.senderId !== friend.id) return;
      const newVoice: VoiceMessageData = {
        id: msg.id,
        senderId: msg.senderId,
        senderName: friend.name,
        audioUrl: msg.audioUrl,
        durationSeconds: msg.durationSeconds,
        status: "delivered",
        createdAt: msg.createdAt,
      };
      setVoiceMessages((prev) => [...prev, newVoice]);
      toast.info(`🎙️ New voice message from ${friend.name}`, { duration: 10_000 });
    });
    return () => unsub?.();
  }, [on, friend.id, friend.name]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    if (!messagesEndRef.current) return;
    // Prefer scrolling the Radix ScrollArea viewport directly (more reliable
    // than scrollIntoView which can accidentally scroll the page on mobile).
    const el = messagesEndRef.current;
    const viewport = el.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    } else {
      el.scrollIntoView({ block: "end" });
    }
  }, [textMessages.length, voiceMessages.length]);

  // ── Combined & sorted message list ────────────────────────────────────────
  const combined: CombinedMessage[] = [
    ...textMessages.map((m) => ({
      kind: "text" as const,
      data: m,
      sortKey: new Date(m.createdAt).getTime(),
    })),
    ...voiceMessages.map((m) => ({
      kind: "voice" as const,
      data: m,
      sortKey: new Date(m.createdAt).getTime(),
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSendText = useCallback(
    async (content: string) => {
      const res = await fetch("/api/text-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: friend.id, content }),
      });
      if (!res.ok) {
        toast.error("Failed to send message");
        return;
      }
      const saved = (await res.json()) as {
        id: string;
        createdAt: string;
        status: string;
      };
      setTextMessages((prev) => [
        ...prev,
        {
          id: saved.id,
          senderId: currentUserId,
          senderName: "You",
          content,
          status: saved.status as "delivered" | "read",
          createdAt: saved.createdAt,
        },
      ]);
    },
    [friend.id, currentUserId]
  );

  // ── Send voice ────────────────────────────────────────────────────────────
  const handleSendVoice = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      console.log(`[voice] blob size=${blob.size} type=${blob.type} durationSeconds=${durationSeconds}`);

      // 1) Upload audio — field name must match POST /api/upload/audio which expects "audio"
      const formData = new FormData();
      formData.append("audio", blob, "voice.webm");
      console.log("[voice] uploading to /api/upload/audio");

      const uploadRes = await fetch("/api/upload/audio", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => uploadRes.statusText);
        console.error(`[voice] upload failed ${uploadRes.status}:`, errText);
        toast.error("Failed to upload voice message");
        return;
      }
      // Route returns { audioUrl } — not { url }
      const { audioUrl } = (await uploadRes.json()) as { audioUrl: string };
      console.log("[voice] upload succeeded, audioUrl=", audioUrl);

      // 2) Store message
      const sendRes = await fetch("/api/voice-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: friend.id, audioUrl, durationSeconds }),
      });
      if (!sendRes.ok) {
        const errText = await sendRes.text().catch(() => sendRes.statusText);
        console.error(`[voice] send failed ${sendRes.status}:`, errText);
        toast.error("Failed to send voice message");
        return;
      }
      const saved = (await sendRes.json()) as {
        id: string;
        createdAt: string;
        status: string;
      };
      toast.success("Voice message sent!");
      setVoiceMessages((prev) => [
        ...prev,
        {
          id: saved.id,
          senderId: currentUserId,
          senderName: "You",
          audioUrl,
          durationSeconds,
          status: "delivered",
          createdAt: saved.createdAt,
        },
      ]);
    },
    [friend.id, currentUserId]
  );

  const initials = friend.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden" role="region" aria-label={`Conversation with ${friend.name}`}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3 shrink-0">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to friends list"
            className="mr-1 h-12 w-12 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-9 w-9 shrink-0">
          {friend.profileImageUrl && (
            <AvatarImage src={friend.profileImageUrl} alt={friend.name} />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{friend.name}</p>
          <p className="text-xs text-muted-foreground">{friend.tag}</p>
        </div>
        {/* Online presence dot */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500"
          aria-label="Online"
        />
      </div>

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Loading conversation…
          </div>
        ) : combined.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-2">
            {combined.map((item) => {
              const isSent = item.data.senderId === currentUserId;
              const variant = isSent ? "sent" : "received";

              return item.kind === "text" ? (
                <MessageBubble
                  key={`t-${item.data.id}`}
                  message={item.data}
                  variant={variant}
                />
              ) : (
                <VoiceMessageBubble
                  key={`v-${item.data.id}`}
                  message={item.data}
                  variant={variant}
                  onListened={(id) =>
                    setVoiceMessages((prev) =>
                      prev.map((m) =>
                        m.id === id ? { ...m, status: "listened" } : m
                      )
                    )
                  }
                />
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* ── Input ── */}
      <MessageInput
        onSendText={handleSendText}
        onSendVoice={handleSendVoice}
        disabled={loading}
      />
    </div>
  );
}
