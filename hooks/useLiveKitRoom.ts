"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RoomConnectOptions,
  type RemoteParticipant,
  type LocalParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
} from "livekit-client";

export interface UseLiveKitRoomOptions {
  liveKitUrl: string;
  token: string;
  /** Room name — used to surface reconnection info and future token refresh */
  roomName?: string;
  audioOnly?: boolean;
  onDisconnected?: () => void;
}

export interface UseLiveKitRoomResult {
  room: Room | null;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  isConnected: boolean;
  /** True while the SDK is actively trying to re-establish a dropped connection */
  isReconnecting: boolean;
  /** Non-null when all retry attempts have been exhausted */
  connectionError: string | null;
  /** Current retry attempt (0 = not retrying, 1-3 = in progress) */
  retryCount: number;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  isMicMuted: boolean;
  isCameraOff: boolean;
}

export function useLiveKitRoom({
  liveKitUrl,
  token,
  roomName = "",
  audioOnly = false,
  onDisconnected,
}: UseLiveKitRoomOptions): UseLiveKitRoomResult {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(audioOnly);
  const onDisconnectedRef = useRef(onDisconnected);
  onDisconnectedRef.current = onDisconnected;
  const audioOnlyRef = useRef(audioOnly);
  audioOnlyRef.current = audioOnly;
  // Keep roomName in a ref so it's accessible inside the effect without
  // triggering a reconnect when only the display name changes.
  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;

  useEffect(() => {

    // Fresh Room per effect invocation — React 18 StrictMode safety.
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    let active = true;

    // sid -> HTMLAudioElement for remote audio tracks.
    const audioEls: Record<string, HTMLAudioElement> = {};

    const connectOptions: RoomConnectOptions = { autoSubscribe: true };

    // ── Audio helpers ─────────────────────────────────────────────
    function attachAudio(pub: RemoteTrackPublication) {
      if (!pub.track) return; // track not yet available
      if (pub.kind !== Track.Kind.Audio) return; // skip video
      if (audioEls[pub.trackSid]) return; // already attached
      const el = pub.track.attach() as HTMLAudioElement;
      el.autoplay = true;
      el.style.display = "none";
      document.body.appendChild(el);
      audioEls[pub.trackSid] = el;
    }

    function detachAll() {
      Object.values(audioEls).forEach((el) => {
        el.pause();
        el.srcObject = null;
        el.remove();
      });
      Object.keys(audioEls).forEach((k) => { delete audioEls[k]; });
    }

    // ── Event handlers ────────────────────────────────────────────
    const onConnected = () => {
      if (!active) return;
      setIsConnected(true);
      setLocalParticipant(room.localParticipant);
      const participants = Array.from(room.remoteParticipants.values());
      setRemoteParticipants(participants);
      // Attach any audio tracks already present at connect time.
      participants.forEach((p) => {
        Array.from(p.trackPublications.values()).forEach((pub) => {
          if (pub.isSubscribed) attachAudio(pub as RemoteTrackPublication);
        });
      });
      // Required by browser autoplay policy.
      void room.startAudio();
    };
    const onRoomDisconnected = () => {
      if (!active) return;
      setIsConnected(false);
      setLocalParticipant(null);
      setRemoteParticipants([]);
      onDisconnectedRef.current?.();
    };
    const onParticipantsChanged = () => {
      if (!active) return;
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
    };
    const onTrackChanged = () => {
      if (!active) return;
      setIsMicMuted(!room.localParticipant.isMicrophoneEnabled);
      setIsCameraOff(!room.localParticipant.isCameraEnabled);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onTrackSubscribed = (_track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (!active) return;
      attachAudio(pub);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onTrackUnsubscribed = (_track: RemoteTrack, pub: RemoteTrackPublication) => {
      const el = audioEls[pub.trackSid];
      // Fix A: video tracks are never inserted into audioEls — guard prevents
      // a "Cannot read properties of undefined" crash on video-track removal.
      if (!el) return;
      if (pub.track) pub.track.detach(el);
      el.pause();
      el.srcObject = null;
      el.remove();
      delete audioEls[pub.trackSid];
    };

    // Add E: show a reconnecting banner while the SDK re-establishes the call
    const onReconnecting = () => { if (active) setIsReconnecting(true); };
    const onReconnected  = () => { if (active) setIsReconnecting(false); };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onRoomDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    room.on(RoomEvent.Reconnected as any, onReconnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantsChanged);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantsChanged);
    room.on(RoomEvent.TrackMuted, onTrackChanged);
    room.on(RoomEvent.TrackUnmuted, onTrackChanged);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed as any);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed as any);

    // Add D: retry with exponential backoff (2 s → 4 s → 8 s) so mobile
    // drivers recover automatically after a brief signal drop.
    void (async () => {
      const MAX_RETRIES = 3;
      let attempt = 0;
      while (attempt <= MAX_RETRIES && active) {
        try {
          if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10_000);
            setConnectionError(`Retrying connection (${attempt}/${MAX_RETRIES})…`);
            setRetryCount(attempt);
            await new Promise<void>((r) => setTimeout(r, delay));
            if (!active) return;
          }
          await room.connect(liveKitUrl, token, connectOptions);
          if (!active) { void room.disconnect(); return; }
          setConnectionError(null);
          setRetryCount(0);
          await room.localParticipant.setMicrophoneEnabled(true);
          if (!audioOnlyRef.current) {
            await room.localParticipant.setCameraEnabled(true);
          }
          return; // success — exit loop
        } catch (err) {
          attempt++;
          if (!active) return;
          if (attempt > MAX_RETRIES) {
            console.error("[useLiveKitRoom] connect failed after retries:", err);
            if (active) setConnectionError("Could not connect. Please check your network.");
          }
        }
      }
    })();

    return () => {
      active = false;
      roomRef.current = null;
      detachAll();
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onRoomDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      room.off(RoomEvent.Reconnected as any, onReconnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantsChanged);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantsChanged);
      room.off(RoomEvent.TrackMuted, onTrackChanged);
      room.off(RoomEvent.TrackUnmuted, onTrackChanged);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed as any);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed as any);
      void room.disconnect();
    };
  }, [liveKitUrl, token]);

  const toggleMic = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    // Fix C: capture the intended value BEFORE await — reading the property
    // after await gives the already-flipped SDK value, inverting it again.
    const next = !lp.isMicrophoneEnabled;
    await lp.setMicrophoneEnabled(next);
    setIsMicMuted(!next);
  }, []);

  const toggleCamera = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    // Fix C: same pre-capture pattern as toggleMic.
    const next = !lp.isCameraEnabled;
    await lp.setCameraEnabled(next);
    setIsCameraOff(!next);
  }, []);

  return {
    room: roomRef.current,
    localParticipant,
    remoteParticipants,
    isConnected,
    isReconnecting,
    connectionError,
    retryCount,
    toggleMic,
    toggleCamera,
    isMicMuted,
    isCameraOff,
  };
}
