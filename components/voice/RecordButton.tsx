"use client";

import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface RecordButtonProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
}

export function RecordButton({ onRecordingComplete, disabled }: RecordButtonProps) {
  const { start, stop, isRecording, audioBlob, durationSeconds, permissionError } =
    useVoiceRecorder();

  // Track which blob we've already notified the parent about so the callback
  // fires exactly once per recording — not on every re-render.
  const notifiedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (audioBlob && durationSeconds > 0 && audioBlob !== notifiedBlobRef.current) {
      notifiedBlobRef.current = audioBlob;
      onRecordingComplete(audioBlob, durationSeconds);
    }
  }, [audioBlob, durationSeconds, onRecordingComplete]);

  const handleStop = () => {
    stop();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {!isRecording ? (
        <Button
          type="button"
          variant="default"
          size="lg"
          className="rounded-full h-16 w-16 p-0"
          disabled={disabled}
          onClick={start}
        >
          <Mic className="h-7 w-7" />
          <span className="sr-only">Start recording</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="lg"
          className={cn(
            "rounded-full h-16 w-16 p-0",
            "animate-pulse"
          )}
          onClick={handleStop}
        >
          <Square className="h-7 w-7" />
          <span className="sr-only">Stop recording</span>
        </Button>
      )}
      <span className="text-xs text-muted-foreground">
        {isRecording ? "Recording… (tap to stop)" : "Tap to record"}
      </span>
      {permissionError && (
        <p className="text-xs text-destructive max-w-[200px] text-center">{permissionError}</p>
      )}
    </div>
  );
}
