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
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Conversations</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No conversations yet. Send a message to a driver to start.
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.partnerId}
              onClick={() => onSelect(conv)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800/50 ${
                selectedDriverId === conv.partnerId ? "bg-gray-800" : ""
              }`}
            >
              {/* Avatar */}
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
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
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-0.5 text-[9px] font-bold text-white">
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white truncate">{conv.partnerName}</p>
                  <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                    {formatRelativeTime(conv.lastMessage.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">
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
