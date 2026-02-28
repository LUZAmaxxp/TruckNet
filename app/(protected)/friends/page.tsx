"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus, Users, Loader2, Check, X, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Friend {
  id: string;
  name: string;
  tag: string;
}

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Users className="h-6 w-6" /> Friends
      </h1>

      {/* Send friend request */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add a Friend
          </CardTitle>
          <CardDescription>Enter a driver&apos;s tag (e.g. john#1234) to send a friend request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sendToId">Driver Tag</Label>
            <div className="flex gap-2">
              <Input
                id="sendToId"
                placeholder="e.g. john#1234"
                value={sendToId}
                onChange={(e) => setSendToId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSendRequest(); }}
              />
              <Button
                onClick={() => void handleSendRequest()}
                disabled={sending || !sendToId.trim()}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incoming requests */}
      {(loadingRequests || requests.length > 0) && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Incoming Requests
              {requests.length > 0 && (
                <Badge variant="destructive" className="ml-2">{requests.length}</Badge>
              )}
            </h2>
            {loadingRequests ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {requests.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 60, scale: 0.95 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Card>
                      <CardContent className="flex items-center justify-between py-3 px-4">
                        <div>
                          <p className="font-medium text-sm">{req.senderName}</p>
                          <Badge variant="outline" className="mt-0.5 text-xs">{req.senderTag}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => void handleAccept(req.id)}
                          >
                            <Check className="h-3 w-3 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleReject(req.id)}
                          >
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Friends list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">My Friends ({friends.length})</h2>
        {loadingFriends ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : friends.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No friends yet. Send a request to get started!
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            {friends.map((friend, i) => (
              <motion.div
                key={friend.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                <Card>
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div>
                      <p className="font-medium text-sm">{friend.name}</p>
                      <Badge variant="secondary" className="mt-0.5 text-xs">{friend.tag}</Badge>
                    </div>
                    <Link href={`/messages?to=${friend.id}`}>
                      <Button size="sm" variant="outline">
                        <Mic className="h-3 w-3 mr-1" /> Voice Message
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
