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

export interface DriverRouteSetPayload {
  driverId: string;
  routeId: string;
  name: string | null;
  profileImageUrl: string | null;
  destinationLabel: string;
  destinationLat: number;
  destinationLng: number;
  distanceMeters: number;
  durationSeconds: number;
  distanceLabel: string;
  durationLabel: string;
  etaIso: string;
}

export interface DriverRouteClearedPayload {
  driverId: string;
  reason: "arrived" | "cancelled";
}

// ── Sensor event payloads ─────────────────────────────────────────────────────

export interface SensorReadingPayload {
  deviceId: string;
  recordedAt: string;
  temperatureC: number;
  humidityPct: number;
  vibrationMagnitude: number;
}

export interface SensorAlertPayload {
  alertId: string;
  deviceId: string;
  truckLabel: string;
  alertType: "temp_high" | "temp_low" | "humidity_high" | "vibration_high";
  value: number;
  threshold: number;
  triggeredAt: string;
}

export interface SensorAlertAckedPayload {
  alertId: string;
  deviceId: string;
  ackedBy: string;
}

/** Sent to the driver's personal user:{driverId} channel */
export interface SensorAlertDriverPayload {
  alertId:     string;
  deviceId:    string;
  truckLabel:  string;
  alertType:   "temp_high" | "temp_low" | "humidity_high" | "vibration_high";
  value:       number;
  threshold:   number;
  triggeredAt: string;
}

export interface DeviceStatusPayload {
  deviceId: string;
  status: "online" | "offline" | "unknown";
  at: string;
}

export interface FleetSensorUpdatePayload {
  devices: {
    deviceId: string;
    truckLabel: string;
    status: "online" | "offline" | "unknown";
    lastSeenAt: string | null;
    firmwareVersion: string | null;
    activeAlertCount: number;
    latestReading: {
      temperatureC: number;
      humidityPct: number;
      vibrationMagnitude: number;
      recordedAt: string;
    } | null;
  }[];
}

// ── Behaviour / Safety event payloads ────────────────────────────────────────

export interface BehaviourEventPayload {
  eventId:    string;
  driverId:   string;
  driverName: string;
  tripId:     string;
  eventType:  string;
  severity:   "low" | "medium" | "high" | "critical";
  source:     "gps" | "esp32" | "camera";
  occurredAt: string;
  score:      number | null;
}

export interface BehaviourReportReadyPayload {
  reportId:    string;
  tripId:      string;
  driverId:    string;
  globalScore: number;
  status:      "ready";
}

export interface BehaviourReportFailedPayload {
  tripId:   string;
  driverId: string;
  reason:   string;
}

// ── Trip update payload ───────────────────────────────────────────────────────

export interface TripUpdatePayload {
  tripId:   string;
  status:   "active" | "completed" | "cancelled";
  /** Full trip data — present when status is "active", null otherwise */
  trip: {
    id:               string;
    vehiclePlate:     string;
    originLabel:      string | null;
    destinationLabel: string | null;
    cargoWeightKg:    number | null;
    startedAt:        string | null;
  } | null;
}

// ── Speed limit event payload ─────────────────────────────────────────────────

export interface SpeedLimitUpdatePayload {
  /** Current road speed limit in km/h, or null if unknown */
  speedLimitKmh:   number | null;
  /** Driver's current GPS speed in km/h */
  currentSpeedKmh: number;
  /** True when driver's speed exceeds speedLimitKmh */
  isOverSpeeding:  boolean;
  /** OSM road name, or null when not fetched */
  roadName:        string | null;
  lat:             number;
  lng:             number;
  timestamp:       string; // ISO-8601
  /** True when the value is served from a stale/fallback source */
  stale?:          boolean;
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
  driver_route_set: (payload: DriverRouteSetPayload) => void;
  driver_route_cleared: (payload: DriverRouteClearedPayload) => void;
  // IoT sensor events
  sensor_reading: (payload: SensorReadingPayload) => void;
  sensor_alert: (payload: SensorAlertPayload) => void;
  sensor_alert_acked: (payload: SensorAlertAckedPayload) => void;
  sensor_alert_driver: (payload: SensorAlertDriverPayload) => void;
  device_status: (payload: DeviceStatusPayload) => void;
  fleet_sensor_update: (payload: FleetSensorUpdatePayload) => void;
  // Behaviour / Safety events
  behaviour_event: (payload: BehaviourEventPayload) => void;
  behaviour_report_ready: (payload: BehaviourReportReadyPayload) => void;
  behaviour_report_failed: (payload: BehaviourReportFailedPayload) => void;
  // Speed limit real-time update for the driver UI
  speed_limit_update: (payload: SpeedLimitUpdatePayload) => void;
  // Trip lifecycle events (start / complete / cancel)
  trip_updated: (payload: TripUpdatePayload) => void;
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
