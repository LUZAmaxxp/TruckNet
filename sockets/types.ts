import type { LocationUpdateInput } from "@/schemas/location.schema";
import type { VoiceMessageInput } from "@/schemas/voice.schema";
import type { StressSignalInput } from "@/schemas/stress.schema";
import type { ZodIssue } from "zod";

// ---------------------------------------------------------------------------
// Client → Server events (emitted by browser clients)
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  update_location: (payload: LocationUpdateInput) => void;
  send_voice_message: (payload: VoiceMessageInput) => void;
  send_stress_signal: (payload: StressSignalInput) => void;
}

// ---------------------------------------------------------------------------
// Server → Client events (emitted by the socket server to connected clients)
// ---------------------------------------------------------------------------

export interface NearbyDriverEntry {
  userId: string;
  latitude: number;
  longitude: number;
  updatedAt: Date;
}

export interface VoiceMessageAlert {
  id: string;
  senderId: string;
  audioUrl: string;
  durationSeconds: number;
  createdAt: Date;
}

export interface StressSignalAlert {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export interface ServerToClientEvents {
  nearby_driver_update: (drivers: NearbyDriverEntry[]) => void;
  voice_message_received: (message: VoiceMessageAlert) => void;
  stress_signal_alert: (signal: StressSignalAlert) => void;
  error: (payload: { error: string; details?: ZodIssue[] }) => void;
}

// ---------------------------------------------------------------------------
// Inter-server events (for future Redis adapter / multi-node scaling)
// ---------------------------------------------------------------------------

export interface InterServerEvents {
  ping: () => void;
}

// ---------------------------------------------------------------------------
// Per-socket data injected by auth middleware
// ---------------------------------------------------------------------------

export interface SocketData {
  userId: string;
}
