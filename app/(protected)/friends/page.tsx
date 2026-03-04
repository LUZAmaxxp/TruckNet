"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus, Loader2, Check, X, MessageSquare, MapPin, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CallButton } from "@/components/calls/CallButton";

interface Friend {
  id: string;
  name: string;
  tag: string;
}

interface FriendLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

type LocationState = "idle" | "loading" | "error" | FriendLocation;

interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderTag: string;
  createdAt: string;
}

export default function FriendsPage() {
  const { on } = useSocket();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Send friend request state
  const [sendToId, setSendToId] = useState("");
  const [sending, setSending] = useState(false);

  // Per-friend location state: "idle" | "loading" | "error" | FriendLocation
  const [friendLocations, setFriendLocations] = useState<Record<string, LocationState>>({});

  async function toggleLocation(friendId: string) {
    const current = friendLocations[friendId] ?? "idle";
    // If already showing location data, hide it
    if (current !== "idle" && current !== "loading") {
      setFriendLocations((prev) => ({ ...prev, [friendId]: "idle" }));
      return;
    }
    setFriendLocations((prev) => ({ ...prev, [friendId]: "loading" }));
    try {
      const res = await fetch(`/api/friends/${friendId}/location`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { location: FriendLocation | null };
      if (!json.location) {
        toast.info("This friend hasn't shared their location yet.");
        setFriendLocations((prev) => ({ ...prev, [friendId]: "idle" }));
        return;
      }
      setFriendLocations((prev) => ({ ...prev, [friendId]: json.location! }));
    } catch {
      setFriendLocations((prev) => ({ ...prev, [friendId]: "error" }));
    }
  }

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    const res = await fetch("/api/friends/list");
    if (res.ok) {
      const json = (await res.json()) as { friends: Friend[] };
      setFriends(json.friends);
    }
    setLoadingFriends(false);
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    const res = await fetch("/api/friends/request");
    if (res.ok) {
      const json = (await res.json()) as { requests: FriendRequest[] };
      setRequests(json.requests);
    }
    setLoadingRequests(false);
  }, []);

  useEffect(() => {
    void fetchFriends();
    void fetchRequests();
  }, [fetchFriends, fetchRequests]);

  // Real-time incoming friend request
  useEffect(() => {
    const unsub = on("friend_request_received", (payload) => {
      toast.info(`Friend request from ${payload.fromUserName} (${payload.fromUserTag})`, { duration: 6000 });
      setRequests((prev) => [
        {
          id: payload.requestId,
          senderId: payload.fromUserId,
          senderName: payload.fromUserName,
          senderTag: payload.fromUserTag,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    });
    return unsub;
  }, [on]);

  // Real-time accepted notification
  useEffect(() => {
    const unsub = on("friend_request_accepted", (payload) => {
      toast.success(`${payload.friendName} accepted your friend request!`);
      setFriends((prev) => [
        { id: payload.friendId, name: payload.friendName, tag: payload.friendTag },
        ...prev,
      ]);
    });
    return unsub;
  }, [on]);

  async function handleSendRequest() {
    if (!sendToId.trim()) return;
    // Validate tag format client-side before calling API
    if (!/^[a-zA-Z0-9_]+#[0-9]{4}$/.test(sendToId.trim())) {
      toast.error("Invalid tag format. Use name#XXXX (e.g. john#1234)");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: sendToId.trim() }),
      });
      if (res.ok) {
        toast.success("Friend request sent!");
        setSendToId("");
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to send request.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(requestId: string) {
    const res = await fetch(`/api/friends/${requestId}/accept`, { method: "PATCH" });
    if (res.ok) {
      toast.success("Friend request accepted!");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      void fetchFriends();
    } else {
      toast.error("Failed to accept request.");
    }
  }

  async function handleReject(requestId: string) {
    const res = await fetch(`/api/friends/${requestId}/reject`, { method: "PATCH" });
    if (res.ok) {
      toast.info("Friend request rejected.");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } else {
      toast.error("Failed to reject request.");
    }
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Page header */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="inline-block h-[1.5px] w-4 rounded-full" style={{ background: "var(--navy-md)" }} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--navy-md)" }}>
            Network
          </span>
        </div>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
          Friends
        </h1>
      </div>

      {/* Send friend request */}
      <div
        className="rounded-lg border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm text-[16px]" style={{ background: "var(--navy-lt)" }}>
            <UserPlus className="h-4 w-4" style={{ color: "var(--navy)" }} />
          </div>
          <span className="font-display text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
            Add a Friend
          </span>
        </div>
        <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
          Enter a driver&apos;s tag (e.g. john#1234) to send a friend request.
        </p>
        <div className="flex gap-2">
          <Input
            id="sendToId"
            placeholder="e.g. john#1234"
            value={sendToId}
            onChange={(e) => setSendToId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSendRequest(); }}
            className="flex-1"
          />
          <Button
            onClick={() => void handleSendRequest()}
            disabled={sending || !sendToId.trim()}
            variant="primary"
            size="icon"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Incoming requests */}
      {(loadingRequests || requests.length > 0) && (
        <div>
          <div className="mb-[14px] flex items-center gap-2">
            <span className="font-display text-[13px] font-semibold leading-none tracking-[-0.01em]" style={{ color: "var(--ink-2)" }}>
              Incoming Requests
            </span>
            {requests.length > 0 && (
              <span
                className="inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[10px] font-semibold"
                style={{ background: "var(--terra-lt)", color: "var(--terra)" }}
              >
                {requests.length}
              </span>
            )}
          </div>
          {loadingRequests ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--muted)" }} />
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {requests.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 60, scale: 0.95 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div
                      className="flex items-center justify-between rounded-[12px] border p-4"
                      style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-xs)" }}
                    >
                      <div>
                        <p className="font-body text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{req.senderName}</p>
                        <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{req.senderTag}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="success" onClick={() => void handleAccept(req.id)}>
                          <Check className="h-3 w-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleReject(req.id)}>
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Friends list */}
      <div>
        <div className="mb-[14px] flex items-center gap-2">
          <span className="font-display text-[13px] font-semibold leading-none tracking-[-0.01em]" style={{ color: "var(--ink-2)" }}>
            My Friends
          </span>
          <span
            className="inline-flex items-center rounded-[10px] px-[7px] py-[2px] font-mono text-[10px]"
            style={{ background: "var(--hairline-2)", color: "var(--muted)" }}
          >
            {friends.length}
          </span>
        </div>
        {loadingFriends ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} />
          </div>
        ) : friends.length === 0 ? (
          <div
            className="rounded-lg border py-10 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-sm)" }}
          >
            <p className="text-[32px] mb-2">👥</p>
            <p className="font-display text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>No friends yet</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Send a request using a driver tag above</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {friends.map((friend, i) => (
                <motion.div
                  key={friend.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18, delay: i * 0.04 }}
                >
                  <div
                    className="overflow-hidden rounded-[12px] border transition-shadow hover:shadow-md"
                    style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-xs)" }}
                  >
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-body text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
                          {friend.name}
                        </p>
                        <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{friend.tag}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CallButton friendId={friend.id} variant="voice" />
                        <Link href={`/messages?to=${friend.id}`}>
                          <button
                            title="Send a message"
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-hairline bg-navy-lt transition-all hover:bg-[#DDE8F4]"
                            aria-label="Open messages"
                          >
                            <MessageSquare className="h-4 w-4" style={{ color: "var(--navy)" }} />
                          </button>
                        </Link>
                        <CallButton friendId={friend.id} variant="video" />
                        <button
                          title="See location"
                          onClick={() => void toggleLocation(friend.id)}
                          className={`flex h-[34px] w-[34px] items-center justify-center rounded-sm border transition-all ${
                            typeof friendLocations[friend.id] === "object"
                              ? "border-[rgba(58,107,82,0.3)] bg-sage-lt"
                              : "border-hairline bg-transparent hover:bg-base-2"
                          }`}
                          aria-label="Toggle location"
                        >
                          {friendLocations[friend.id] === "loading" ? (
                            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--muted)" }} />
                          ) : (
                            <MapPin
                              className="h-4 w-4"
                              style={{
                                color: typeof friendLocations[friend.id] === "object"
                                  ? "var(--sage)"
                                  : "var(--ink-2)"
                              }}
                            />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Inline location reveal */}
                    <AnimatePresence initial={false}>
                      {typeof friendLocations[friend.id] === "object" && (
                        <motion.div
                          key="loc"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div
                            className="mx-4 mb-4 rounded-[8px] px-[14px] py-3 flex items-center justify-between gap-3"
                            style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
                          >
                            <div>
                              <p className="font-mono text-[12px] font-medium" style={{ color: "var(--navy)" }}>
                                {(friendLocations[friend.id] as FriendLocation).latitude.toFixed(5)},{" "}
                                {(friendLocations[friend.id] as FriendLocation).longitude.toFixed(5)}
                              </p>
                              <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--muted)" }}>
                                <Clock className="h-3 w-3" />
                                {(() => {
                                  const diff = Math.round(
                                    (Date.now() - new Date((friendLocations[friend.id] as FriendLocation).updatedAt).getTime()) / 60_000
                                  );
                                  return diff < 1 ? "Just now" : diff < 60 ? `${diff} min ago` : `${Math.round(diff / 60)} h ago`;
                                })()}
                              </p>
                            </div>
                            <Link
                              href={`/map?focus=${friend.id}`}
                              className="text-[12px] font-semibold flex items-center gap-1 shrink-0 hover:underline"
                              style={{ color: "var(--navy)" }}
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              View on Map
                            </Link>
                          </div>
                        </motion.div>
                      )}
                      {friendLocations[friend.id] === "error" && (
                        <motion.div
                          key="err"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="mx-4 mb-3 text-[12px]" style={{ color: "var(--terra)" }}>
                            Could not fetch location. Try again.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
