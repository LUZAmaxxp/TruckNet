"use client";

import { Suspense } from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Send, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { RecordButton } from "@/components/voice/RecordButton";
import { VoiceMessageItem, type VoiceMessageData } from "@/components/voice/VoiceMessageItem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function MessagesContent() {
  const searchParams = useSearchParams();
  const preselectedReceiver = searchParams.get("to") ?? "";

  const { on } = useSocket();

  const [inbox, setInbox] = useState<VoiceMessageData[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [receiverId, setReceiverId] = useState(preselectedReceiver);
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
      const msgRes = await fetch("/api/voice-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: receiverId.trim(),
          audioUrl,
          durationSeconds: pendingBlob.durationSeconds,
        }),
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
          <CardDescription>Record up to 60 seconds and send to a driver by their User ID.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="receiverId">Receiver User ID</Label>
            <Input
              id="receiverId"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
            />
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
            <RecordButton
              onRecordingComplete={handleRecordingComplete}
              disabled={sending}
            />
            {pendingBlob && (
              <p className="text-sm text-muted-foreground">
                Recording ready ({pendingBlob.durationSeconds}s) — tap Send
              </p>
            )}
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
          <div className="space-y-2">
            {inbox.map((msg) => (
              <VoiceMessageItem key={msg.id} message={msg} onListened={handleListened} />
            ))}
          </div>
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