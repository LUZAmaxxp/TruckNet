"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";
import type { Friend } from "@/components/messages/ChatPanel";

interface FriendEntry extends Friend {
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
}

interface FriendsSidebarProps {
  activeFriendId: string | null;
  onSelectFriend: (friend: Friend) => void;
  /** If set, automatically open this conversation once contacts are loaded */
  autoOpenId?: string | null;
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date?: Date): string {
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function FriendsSidebar({ activeFriendId, onSelectFriend, autoOpenId }: FriendsSidebarProps) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const { on } = useSocket();
  const autoOpenFired = useRef(false);

  // ── Fetch friends + non-friend conversations (e.g. admin messages) ────────
  useEffect(() => {
    async function load() {
      const [friendsRes, convsRes] = await Promise.all([
        fetch("/api/friends/list"),
        fetch("/api/text-messages/conversations"),
      ]);

      const { friends: rawFriends } = (await friendsRes.json()) as {
        friends: Friend[];
      };

      const { conversations: convData } = (await convsRes.json()) as {
        conversations?: Array<{
          partnerId: string;
          partnerName: string;
          partnerTag: string;
          partnerAvatar: string | null;
          lastMessage: { content: string; createdAt: string; isSelf: boolean };
          unreadCount: number;
        }>;
      };

      // Merge non-friend conversation partners (e.g. admins) into the list
      const friendIds = new Set(rawFriends.map((f) => f.id));
      const extraContacts: Friend[] = (convData ?? [])
        .filter((c) => !friendIds.has(c.partnerId))
        .map((c) => ({
          id: c.partnerId,
          name: c.partnerName,
          tag: c.partnerTag ?? "",
          profileImageUrl: c.partnerAvatar,
        }));

      const allContacts = [...rawFriends, ...extraContacts];

      // Build a lastMessage + unreadCount map keyed by partnerId from conversations API
      const infoMap = new Map<
        string,
        { lastMessage: string; lastMessageAt: Date; unreadCount: number }
      >();

      for (const c of convData ?? []) {
        infoMap.set(c.partnerId, {
          lastMessage: c.lastMessage.content,
          lastMessageAt: new Date(c.lastMessage.createdAt),
          unreadCount: c.unreadCount,
        });
      }

      // For friends not yet in conversations API (no messages yet), fetch previews
      const friendsWithoutConv = rawFriends.filter((f) => !infoMap.has(f.id));
      if (friendsWithoutConv.length > 0) {
        const previews = await Promise.all(
          friendsWithoutConv.map(async (f) => {
            const r = await fetch(`/api/text-messages?friendId=${f.id}`);
            if (!r.ok) return { id: f.id, messages: [] as Array<{ senderId: string; content: string; status: string; createdAt: string }> };
            const { messages } = (await r.json()) as {
              messages: Array<{ id: string; senderId: string; content: string; status: string; createdAt: string }>;
            };
            return { id: f.id, messages };
          })
        );
        for (const preview of previews) {
          const msgs = preview.messages;
          if (msgs.length === 0) continue;
          const last = msgs[msgs.length - 1]!;
          const unread = msgs.filter((m) => m.senderId === preview.id && m.status === "delivered").length;
          infoMap.set(preview.id, {
            lastMessage: last.content,
            lastMessageAt: new Date(last.createdAt),
            unreadCount: unread,
          });
        }
      }

      const entries: FriendEntry[] = allContacts.map((f) => ({
        ...f,
        ...(infoMap.get(f.id) ?? { unreadCount: 0 }),
      }));

      // Sort by last message time — conversations with messages first
      entries.sort((a, b) => {
        const ta = a.lastMessageAt?.getTime() ?? 0;
        const tb = b.lastMessageAt?.getTime() ?? 0;
        return tb - ta;
      });

      setFriends(entries);
      setLoading(false);
    }
    void load();
  }, []);

  // ── Real-time: update sidebar preview on incoming text message ────────────
  useEffect(() => {
    const unsub = on("text_message_received", (msg) => {
      setFriends((prev) => {
        const exists = prev.find((f) => f.id === msg.senderId);
        if (exists) {
          return prev.map((f) =>
            f.id === msg.senderId
              ? {
                  ...f,
                  lastMessage: msg.content,
                  lastMessageAt: new Date(msg.createdAt),
                  unreadCount:
                    activeFriendId === f.id ? f.unreadCount : f.unreadCount + 1,
                }
              : f
          );
        }
        // Sender is not a friend (e.g. admin) — append them to the sidebar
        return [
          ...prev,
          {
            id: msg.senderId,
            name: msg.senderName ?? "Unknown",
            tag: "",
            profileImageUrl: null,
            lastMessage: msg.content,
            lastMessageAt: new Date(msg.createdAt),
            unreadCount: activeFriendId === msg.senderId ? 0 : 1,
          },
        ];
      });
    });
    return () => unsub?.();
  }, [on, activeFriendId]);

  // ── Auto-open a specific conversation once loaded ───────────────────────
  useEffect(() => {
    if (!autoOpenId || loading || autoOpenFired.current) return;
    const target = friends.find((f) => f.id === autoOpenId);
    if (target) {
      autoOpenFired.current = true;
      onSelectFriend(target);
    }
  }, [autoOpenId, loading, friends, onSelectFriend]);

  // ── Reset unread when user opens conversation ─────────────────────────────
  useEffect(() => {
    if (!activeFriendId) return;
    setFriends((prev) =>
      prev.map((f) =>
        f.id === activeFriendId ? { ...f, unreadCount: 0 } : f
      )
    );
  }, [activeFriendId]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return friends;
    const q = debouncedSearch.toLowerCase();
    return friends.filter(
      (f) => f.name.toLowerCase().includes(q) || f.tag.toLowerCase().includes(q)
    );
  }, [friends, debouncedSearch]);

  return (
    <div className="flex h-full flex-col bg-muted/40 border-r border-border overflow-hidden" role="navigation" aria-label="Friends list">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="mb-3 text-lg font-semibold">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends…"
            className="pl-9 rounded-xl"
            aria-label="Search friends"
          />
        </div>
      </div>

      <Separator />

      {/* ── Friends list ── */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading friends…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p className="text-sm">{search ? "No results" : "No friends yet"}</p>
          </div>
        ) : (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="py-2"
            role="listbox"
            aria-label="Friends"
          >
            <AnimatePresence>
              {filtered.map((f) => {
                const isActive = f.id === activeFriendId;
                return (
                  <motion.li
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    whileHover={{ scale: 1.02 }}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectFriend(f);
                    }}
                    onClick={() => onSelectFriend(f)}
                    className={cn(
                      "relative mx-2 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-accent/60"
                    )}
                  >
                    {/* Active left-border indicator */}
                    {isActive && (
                      <motion.span
                        layoutId="active-indicator"
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary"
                        transition={{ type: "spring", damping: 25, stiffness: 400 }}
                      />
                    )}

                    {/* Avatar + online dot */}
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        {f.profileImageUrl && (
                          <AvatarImage src={f.profileImageUrl} alt={f.name} />
                        )}
                        <AvatarFallback>{initials(f.name)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                    </div>

                    {/* Text info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="truncate text-sm font-medium leading-tight">
                          {f.name}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelativeTime(f.lastMessageAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {f.lastMessage ?? f.tag}
                      </p>
                    </div>

                    {/* Unread badge */}
                    {f.unreadCount > 0 && (
                      <Badge
                        className="ml-1 h-5 min-w-[20px] shrink-0 rounded-full px-1.5 text-[10px]"
                        aria-label={`${f.unreadCount} unread messages`}
                      >
                        {f.unreadCount > 99 ? "99+" : f.unreadCount}
                      </Badge>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </ScrollArea>
    </div>
  );
}
