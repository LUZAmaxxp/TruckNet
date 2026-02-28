"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/** Maximum recording duration in milliseconds (60 seconds). */
const MAX_DURATION_MS = 60_000;

export interface UseVoiceRecorderResult {
  /** Start recording from the default microphone. */
  start: () => Promise<void>;
  /** Stop recording manually (also called automatically at 60 s). */
  stop: () => void;
  /** True while the MediaRecorder is actively recording. */
  isRecording: boolean;
  /** The recorded audio Blob, available once recording has stopped. Null while idle or recording. */
  audioBlob: Blob | null;
  /** Actual recorded duration in whole seconds, set after stopping. */
  durationSeconds: number;
  /** Set to a human-readable message when microphone permission is denied. */
  permissionError: string | null;
}

/**
 * useVoiceRecorder
 *
 * React hook wrapping the Web MediaRecorder API.
 *
 * Features:
 *   - Requests microphone permission on `start()`
 *   - Auto-stops after 60 seconds regardless of manual interaction
 *   - Releases microphone tracks on stop and on unmount
 *   - Returns a Blob ready for upload to POST /api/upload/audio
 *   - Surfaces permission-denial or API-unavailability via `permissionError`
 *
 * @example
 *   const { start, stop, isRecording, audioBlob, durationSeconds, permissionError } = useVoiceRecorder();
 */
export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setPermissionError(null);
    setAudioBlob(null);
    setDurationSeconds(0);
    chunksRef.current = [];

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPermissionError("MediaRecorder API is not available in this environment.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access and try again."
          : err instanceof Error
            ? err.message
            : "Unable to access microphone.";
      setPermissionError(message);
      return;
    }

    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined,
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      setAudioBlob(blob);
      setDurationSeconds(elapsed);
      setIsRecording(false);
      releaseTracks();
    };

    startTimeRef.current = Date.now();
    setIsRecording(true);
    recorder.start(100); // collect data every 100ms

    // Auto-stop at 60 seconds
    autoStopTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, MAX_DURATION_MS);
  }, [releaseTracks]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      releaseTracks();
    };
  }, [releaseTracks]);

  return { start, stop, isRecording, audioBlob, durationSeconds, permissionError };
}
