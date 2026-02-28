"use client";

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

  // Forward blob up once recording completes
  if (audioBlob && durationSeconds > 0) {
    // Use a one-shot ref pattern via key to avoid calling on every render
  }

  // Notify parent when recording finishes
  const handleStop = () => {
    stop();
  };

  // After blob is available, fire callback
  const prevBlobRef = { current: null as Blob | null };

  if (audioBlob && audioBlob !== prevBlobRef.current) {
    prevBlobRef.current = audioBlob;
    // Schedule so we don't call during render
    setTimeout(() => onRecordingComplete(audioBlob, durationSeconds), 0);
  }

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
