"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerTag: string;
  partnerAvatar: string | null;
  lastMessage: {
    content: string;
    createdAt: Date | string;
    isSelf: boolean;
  };
  unreadCount: number;
}

interface AdminConversationListProps {
  selectedDriverId?: string | null;
  onSelect: (conv: Conversation) => void;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

/**
 * AdminConversationList — sidebar listing all admin conversation partners.
 */
export function AdminConversationList({
  selectedDriverId,
  onSelect,
}: AdminConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/text-messages/conversations")
      .then((r) => r.json())
      .then((d: { conversations?: Conversation[] }) => {
        setConversations(d.conversations ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <h2 className="font-display text-[13px] font-bold" style={{ color: "var(--ink)" }}>Conversations</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center font-body text-[13px]" style={{ color: "var(--muted)" }}>
            No conversations yet. Send a message to a driver to start.
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.partnerId}
              onClick={() => onSelect(conv)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
              style={{
                borderBottom: "1px solid var(--hairline)",
                background: selectedDriverId === conv.partnerId ? "var(--navy-lt)" : "transparent",
              }}
              onMouseEnter={(e) => { if (selectedDriverId !== conv.partnerId) e.currentTarget.style.background = "var(--base)"; }}
              onMouseLeave={(e) => { if (selectedDriverId !== conv.partnerId) e.currentTarget.style.background = "transparent"; }}
            >
              <div
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full flex items-center justify-center font-display text-[13px] font-bold"
                style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
              >
                {conv.partnerAvatar ? (
                  <img
                    src={conv.partnerAvatar}
                    alt={conv.partnerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  conv.partnerName[0]?.toUpperCase()
                )}
                {conv.unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-[10px] px-0.5 font-mono text-[9px] font-bold"
                    style={{ background: "var(--navy)", color: "white" }}
                  >
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{conv.partnerName}</p>
                  <span className="font-mono text-[10px] shrink-0 ml-2" style={{ color: "var(--subtle)" }}>
                    {formatRelativeTime(conv.lastMessage.createdAt)}
                  </span>
                </div>
                <p className="font-body text-[12px] truncate" style={{ color: "var(--muted)" }}>
                  {conv.lastMessage.isSelf ? "You: " : ""}
                  {conv.lastMessage.content}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
