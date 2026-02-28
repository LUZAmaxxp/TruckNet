"use client";

import { Suspense } from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Send, Loader2, Search, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { RecordButton } from "@/components/voice/RecordButton";
import { VoiceMessageItem, type VoiceMessageData } from "@/components/voice/VoiceMessageItem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

function MessagesContent() {
  const searchParams = useSearchParams();
  const preselectedReceiver = searchParams.get("to") ?? "";

  const { on } = useSocket();

  const [inbox, setInbox] = useState<VoiceMessageData[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [receiverId, setReceiverId] = useState(preselectedReceiver);
  const [tagSearch, setTagSearch] = useState("");
  const [tagSearchResult, setTagSearchResult] = useState<{ id: string; name: string; tag: string } | null>(null);
  const [searchingTag, setSearchingTag] = useState(false);
  const [pendingBlob, setPendingBlob] = useState<{ blob: Blob; durationSeconds: number } | null>(null);
  const [sending, setSending] = useState(false);
  const sentBlobRef = useRef<Blob | null>(null);

  // Fetch inbox
  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true);
    const res = await fetch("/api/voice-messages");
    if (res.ok) {
      const json = (await res.json()) as { messages: VoiceMessageData[] };
      setInbox(json.messages);
    }
    setLoadingInbox(false);
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Live voice message notification
  useEffect(() => {
    const unsub = on("voice_message_received", (msg) => {
      toast.info("🎙️ New voice message!", { duration: 5000 });
      // Add to top of inbox
      setInbox((prev) => [
        {
          id: msg.id,
          senderId: msg.senderId,
          senderName: "Driver", // enriched on next full fetch
          audioUrl: msg.audioUrl,
          durationSeconds: msg.durationSeconds,
          status: "delivered",
          createdAt: msg.createdAt,
        },
        ...prev,
      ]);
    });
    return unsub;
  }, [on]);

  // Handle recording complete from RecordButton
  function handleRecordingComplete(blob: Blob, durationSeconds: number) {
    if (blob === sentBlobRef.current) return;
    setPendingBlob({ blob, durationSeconds });
  }

  // Search user by tag (e.g. "john#1234")
  async function handleTagSearch() {
    if (!tagSearch.trim()) return;
    setSearchingTag(true);
    setTagSearchResult(null);
    try {
      const res = await fetch(`/api/users/by-tag?tag=${encodeURIComponent(tagSearch.trim())}`);
      if (!res.ok) {
        toast.error("User not found with that tag.");
        return;
      }
      const user = (await res.json()) as { id: string; name: string; tag: string };
      setTagSearchResult(user);
      setReceiverId(user.id);
      toast.success(`Found: ${user.name} (${user.tag})`);
    } catch {
      toast.error("Failed to search by tag.");
    } finally {
      setSearchingTag(false);
    }
  }

  // Send flow: upload audio → post message
  async function handleSend() {
    if (!pendingBlob) {
      toast.error("Please record a message first.");
      return;
    }
    if (!receiverId.trim()) {
      toast.error("Enter the receiver's User ID.");
      return;
    }

    setSending(true);
    sentBlobRef.current = pendingBlob.blob;
    try {
      // 1. Upload audio
      const formData = new FormData();
      formData.append("audio", pendingBlob.blob, "recording.webm");

      const uploadRes = await fetch("/api/upload/audio", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        toast.error("Audio upload failed.");
        setSending(false);
        return;
      }
      const { audioUrl } = (await uploadRes.json()) as { audioUrl: string };

      // 2. Create voice message record
      // Send tag if input is tag format; otherwise send UUID
      const trimmedReceiver = receiverId.trim();
      const isTagFormat = /^[a-zA-Z0-9_]+#[0-9]{4}$/.test(trimmedReceiver);
      const msgPayload = isTagFormat
        ? { tag: trimmedReceiver, audioUrl, durationSeconds: pendingBlob.durationSeconds }
        : { receiverId: trimmedReceiver, audioUrl, durationSeconds: pendingBlob.durationSeconds };

      const msgRes = await fetch("/api/voice-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgPayload),
      });

      if (!msgRes.ok) {
        const err = await msgRes.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? "Failed to send message.");
        setSending(false);
        return;
      }

      toast.success("Voice message sent!");
      setPendingBlob(null);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSending(false);
    }
  }

  // Mark as listened
  async function handleListened(id: string) {
    await fetch(`/api/voice-messages/${id}/status`, { method: "PATCH" });
    setInbox((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "listened" as const } : m))
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Voice Messages</h1>

      {/* Send section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send a Voice Message</CardTitle>
          <CardDescription>Record up to 60 seconds. Search by tag above, or type a tag (e.g. john#1234) or User ID directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tag search */}
          <div className="space-y-1">
            <Label htmlFor="tagSearch">Search by Driver Tag</Label>
            <div className="flex gap-2">
              <Input
                id="tagSearch"
                placeholder="e.g. john#1234"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleTagSearch(); }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleTagSearch()}
                disabled={searchingTag || !tagSearch.trim()}
              >
                {searchingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {tagSearchResult && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span>{tagSearchResult.name}</span>
                <Badge variant="secondary">{tagSearchResult.tag}</Badge>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-1">
            <Label htmlFor="receiverId">Receiver User ID</Label>
            <Input
              id="receiverId"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={receiverId}
              onChange={(e) => { setReceiverId(e.target.value); setTagSearchResult(null); }}
            />
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
            <RecordButton
              onRecordingComplete={handleRecordingComplete}
              disabled={sending}
            />
            <AnimatePresence>
              {pendingBlob && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-sm text-muted-foreground"
                >
                  Recording ready ({pendingBlob.durationSeconds}s) — tap Send
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <Button
            className="w-full"
            disabled={!pendingBlob || sending || !receiverId.trim()}
            onClick={handleSend}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Inbox */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <Button variant="ghost" size="sm" onClick={fetchInbox} disabled={loadingInbox}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingInbox ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loadingInbox ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : inbox.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No voice messages yet.
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            {inbox.map((msg, i) => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                <VoiceMessageItem message={msg} onListened={handleListened} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}