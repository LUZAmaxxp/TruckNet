"use client";

import { useEffect, useState, useMemo } from "react";
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

export function FriendsSidebar({ activeFriendId, onSelectFriend }: FriendsSidebarProps) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);
  const { on } = useSocket();

  // ── Fetch friends + seed last messages ───────────────────────────────────
  useEffect(() => {
    async function load() {
      const [friendsRes, textRes, voiceRes] = await Promise.all([
        fetch("/api/friends/list"),
        fetch("/api/text-messages?friendId=all").catch(() => null), // may 400 – handled below
        fetch("/api/voice-messages"),
      ]);

      const { friends: rawFriends } = (await friendsRes.json()) as {
        friends: Friend[];
      };

      // Build a lastMessage + unreadCount map keyed by friendId
      const infoMap = new Map<
        string,
        { lastMessage: string; lastMessageAt: Date; unreadCount: number }
      >();

      // We fetch per-friend conversations separately for preview;
      // to avoid N+1 we run them in parallel (friends list is typically small)
      const previews = await Promise.all(
        rawFriends.map(async (f) => {
          const r = await fetch(`/api/text-messages?friendId=${f.id}`);
          if (!r.ok) return { id: f.id, messages: [] as Array<{ senderId: string; content: string; status: string; createdAt: string }> };
          const { messages } = (await r.json()) as {
            messages: Array<{
              id: string;
              senderId: string;
              content: string;
              status: string;
              createdAt: string;
            }>;
          };
          return { id: f.id, messages };
        })
      );

      for (const preview of previews) {
        const msgs = preview.messages;
        if (msgs.length === 0) continue;
        const last = msgs[msgs.length - 1]!;
        const unread = msgs.filter(
          (m) => m.senderId === preview.id && m.status === "delivered"
        ).length;
        infoMap.set(preview.id, {
          lastMessage: last.content,
          lastMessageAt: new Date(last.createdAt),
          unreadCount: unread,
        });
      }

      setFriends(
        rawFriends.map((f) => ({
          ...f,
          ...(infoMap.get(f.id) ?? { unreadCount: 0 }),
        }))
      );
      setLoading(false);
    }
    void load();
  }, []);

  // ── Real-time: update sidebar preview on incoming text message ────────────
  useEffect(() => {
    const unsub = on("text_message_received", (msg) => {
      setFriends((prev) =>
        prev.map((f) =>
          f.id === msg.senderId
            ? {
                ...f,
                lastMessage: msg.content,
                lastMessageAt: new Date(msg.createdAt),
                // Only increment unread if not the active conversation
                unreadCount:
                  activeFriendId === f.id ? f.unreadCount : f.unreadCount + 1,
              }
            : f
        )
      );
    });
    return () => unsub?.();
  }, [on, activeFriendId]);

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
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.04 } },
              hidden: {},
            }}
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
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
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
