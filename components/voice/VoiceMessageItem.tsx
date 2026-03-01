"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, CheckCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface VoiceMessageData {
  id: string;
  senderId: string;
  senderName: string;
  audioUrl: string;
  durationSeconds: number;
  status: "delivered" | "listened";
  createdAt: string | Date;
}

interface VoiceMessageItemProps {
  message: VoiceMessageData;
  onListened?: (id: string) => void;
}

export function VoiceMessageItem({ message, onListened }: VoiceMessageItemProps) {
  const [playing, setPlaying] = useState(false);
  // Use a ref so the Audio element is never garbage-collected during a re-render
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pause and release the audio element when the component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  function handlePlay() {
    // — Pause if already playing —
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    // — Tear down any previous audio object before creating a new one —
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(message.audioUrl);
    // Store in ref immediately — the ref update is synchronous and keeps
    // the object alive across any React re-renders triggered below.
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      setPlaying(false);
      if (message.status === "delivered" && onListened) {
        onListened(message.id);
      }
    });

    audio.addEventListener("error", (e) => {
      console.error("[VoiceMessageItem] Audio load/playback error:", e);
      setPlaying(false);
    });

    // Only mark as playing AFTER the browser confirms playback has started
    audio
      .play()
      .then(() => setPlaying(true))
      .catch((err) => {
        console.error("[VoiceMessageItem] play() rejected:", err);
        setPlaying(false);
      });
  }

  const createdAt = new Date(message.createdAt);
  const timeLabel = createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateLabel = createdAt.toLocaleDateString([], { month: "short", day: "numeric" });

  const durationLabel =
    message.durationSeconds < 60
      ? `${Math.round(message.durationSeconds)}s`
      : `${Math.floor(message.durationSeconds / 60)}m ${Math.round(message.durationSeconds % 60)}s`;

  return (
    <Card className={cn("w-full", message.status === "delivered" && "border-primary/40")}>
      <CardContent className="flex items-center gap-3 py-3 px-4">
        {/* Play/Pause button */}
        <Button
          variant={playing ? "destructive" : "default"}
          size="sm"
          className="rounded-full h-9 w-9 p-0 shrink-0"
          onClick={handlePlay}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </Button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{message.senderName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{durationLabel}</span>
          </div>
        </div>

        {/* Status + timestamp */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">
            {dateLabel} {timeLabel}
          </span>
          {message.status === "listened" ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCheck className="h-3 w-3 mr-1" />
              Listened
            </Badge>
          ) : (
            <Badge variant="default" className="text-xs">New</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
