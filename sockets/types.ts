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
  profileImageUrl?: string | null;
  name?: string;
  distanceKm?: number;
}

export interface VoiceMessageAlert {
  id: string;
  senderId: string;
  senderName: string | null;
  audioUrl: string;
  durationSeconds: number;
  createdAt: Date;
}

export interface StressSignalAlert {
  id: string;
  userId: string;
  senderName: string | null;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export interface FriendRequestAlert {
  requestId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserTag: string;
}

export interface FriendRequestAcceptedAlert {
  requestId: string;
  friendId: string;
  friendName: string;
  friendTag: string;
}

export interface TextMessageAlert {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date;
}

export interface CallIncomingAlert {
  roomName: string;
  type: "voice" | "video";
  callerName: string;
  callerAvatar: string | null;
  callerUserId: string;
  liveKitUrl: string;
  /** Pre-generated LiveKit JWT for the callee — avoids a second round-trip */
  calleeToken: string;
}

export interface CallDeclinedAlert {
  roomName: string;
}

export interface CallMissedAlert {
  roomName: string;
  callerName: string;
}

export interface CallEndedAlert {
  roomName: string;
  duration: number | null;
}

export interface FleetDriverUpdate {
  userId: string;
  name: string | null;
  profileImageUrl: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface ServerToClientEvents {
  nearby_driver_update: (drivers: NearbyDriverEntry[]) => void;
  voice_message_received: (message: VoiceMessageAlert) => void;
  text_message_received: (message: TextMessageAlert) => void;
  stress_signal_alert: (signal: StressSignalAlert) => void;
  friend_request_received: (payload: FriendRequestAlert) => void;
  friend_request_accepted: (payload: FriendRequestAcceptedAlert) => void;
  call_incoming: (payload: CallIncomingAlert) => void;
  call_declined: (payload: CallDeclinedAlert) => void;
  call_missed: (payload: CallMissedAlert) => void;
  call_ended: (payload: CallEndedAlert) => void;
  driver_location_updated: (driver: FleetDriverUpdate) => void;
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
