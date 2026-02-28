/**
 * Socket.io integration tests
 *
 * Creates an in-process Socket.io server with a test auth middleware
 * (bypasses JWT, reads userId from handshake.auth.userId) and tests
 * all three event handlers end-to-end using socket.io-client.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { vi } from "vitest";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/sockets/types";

// ── DB mock (must be hoisted before any handler import) ──────────────────────
// vi.hoisted ensures these variables are initialised before vi.mock's factory
// runs (vi.mock calls are hoisted to the top of the file by Vitest).

const { mockDbInsert, mockDbValues, mockDbReturning } = vi.hoisted(() => {
  const mockDbReturning = vi.fn().mockResolvedValue([{
    id: "msg-uuid",
    senderId: "user-A",
    receiverId: "user-B",
    audioUrl: "https://cdn.test.com/audio.webm",
    durationSeconds: 10,
    status: "delivered",
    createdAt: new Date(),
  }]);
  const mockDbValues = vi.fn(() => ({ returning: mockDbReturning }));
  const mockDbInsert = vi.fn(() => ({ values: mockDbValues }));
  return { mockDbInsert, mockDbValues, mockDbReturning };
});

vi.mock("@/db", () => ({
  db: { insert: mockDbInsert },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { registerLocationHandler } from "@/sockets/handlers/location.handler";
import { registerVoiceHandler } from "@/sockets/handlers/voice.handler";
import { registerStressHandler } from "@/sockets/handlers/stress.handler";
import type { Server as HTTPServer } from "node:http";
import { setDriverLocation, getDriverLocation } from "@/sockets/store/location.store";

// ── Test server helpers ───────────────────────────────────────────────────────

let httpServer: HTTPServer;
let io: SocketServer;
let port: number;

/**
 * Creates a socket client that presents itself as `userId`.
 * The test auth middleware reads this from handshake.auth.userId.
 */
function createClient(
  userId: string,
  opts?: { auth?: Record<string, unknown> }
): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  return ioClient<ServerToClientEvents, ClientToServerEvents>(
    `http://localhost:${port}`,
    {
      auth: { userId, ...opts?.auth },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    }
  );
}

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) { resolve(); return; }
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    setTimeout(() => reject(new Error("Connect timeout")), 5000);
  });
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

/** Maps userId → server-side socket.id (set on every connection). */
const serverSocketIds = new Map<string, string>();

beforeAll(async () => {
  httpServer = createServer();
  io = new SocketServer(httpServer, {
    cors: { origin: "*" },
  });

  // Test auth middleware: reads userId from handshake.auth.userId
  // (bypasses JWT for testing purposes)
  io.use((socket, next) => {
    const userId = (socket.handshake.auth as Record<string, unknown>).userId as string | undefined;
    if (!userId) return next(new Error("unauthorized"));
    (socket.data as SocketData).userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    // Track server-side socket ID per user for test verification
    serverSocketIds.set((socket.data as SocketData).userId, socket.id);
    socket.on("disconnect", () => serverSocketIds.delete((socket.data as SocketData).userId));

    registerLocationHandler(io as Parameters<typeof registerLocationHandler>[0], socket as Parameters<typeof registerLocationHandler>[1]);
    registerVoiceHandler(io as Parameters<typeof registerVoiceHandler>[0], socket as Parameters<typeof registerVoiceHandler>[1]);
    registerStressHandler(io as Parameters<typeof registerStressHandler>[0], socket as Parameters<typeof registerStressHandler>[1]);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    io.close(() => httpServer.close(() => resolve()));
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Socket auth middleware", () => {
  it("rejects connection without userId in handshake", async () => {
    const badClient = ioClient(`http://localhost:${port}`, {
      auth: {},
      transports: ["websocket"],
      reconnection: false,
      timeout: 3000,
    });

    const err = await new Promise<Error>((res) => {
      badClient.on("connect_error", res);
      setTimeout(() => res(new Error("no error received")), 3000);
    });

    expect(err.message).toContain("unauthorized");
    badClient.disconnect();
  });

  it("accepts connection with valid userId", async () => {
    const client = createClient("test-user-connect");
    await waitForConnect(client);
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

describe("update_location → nearby_driver_update", () => {
  let clientA: ClientSocket<ServerToClientEvents, ClientToToServerEvents>;
  let clientB: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

  type ClientToToServerEvents = ClientToServerEvents;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emitting update_location returns nearby_driver_update to the same client", async () => {
    clientA = createClient("location-user-A");
    await waitForConnect(clientA);

    const nearbyPromise = waitForEvent<unknown[]>(clientA, "nearby_driver_update");

    clientA.emit("update_location", { latitude: 48.8566, longitude: 2.3522 });

    const nearby = await nearbyPromise;
    expect(Array.isArray(nearby)).toBe(true);

    clientA.disconnect();
  });

  it("two nearby clients see each other after location update", async () => {
    clientA = createClient("nearby-user-A");
    clientB = createClient("nearby-user-B");

    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    // Client B broadcasts location first (same lat/lng = 0 km apart)
    clientB.emit("update_location", { latitude: 48.8566, longitude: 2.3522 });
    await new Promise((r) => setTimeout(r, 100)); // slight delay for store to update

    // Client A broadcasts — should receive B in nearby
    const nearbyPromise = waitForEvent<unknown[]>(clientA, "nearby_driver_update");
    clientA.emit("update_location", { latitude: 48.8566, longitude: 2.3522 });

    const nearby = await nearbyPromise;
    expect(Array.isArray(nearby)).toBe(true);
    expect(nearby.length).toBeGreaterThanOrEqual(1);

    clientA.disconnect();
    clientB.disconnect();
  });

  it("emitting invalid payload receives error event", async () => {
    clientA = createClient("invalid-location-user");
    await waitForConnect(clientA);

    const errPromise = waitForEvent<{ error: string }>(clientA, "error");
    clientA.emit("update_location", { latitude: "bad", longitude: "data" } as unknown as { latitude: number; longitude: number });

    const err = await errPromise;
    expect(err.error).toContain("Invalid");

    clientA.disconnect();
  });
});

describe("send_voice_message → voice_message_received", () => {
  let sender: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let receiver: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbReturning.mockResolvedValue([{
      id: "voice-msg-uuid",
      senderId: "11111111-0000-0000-0000-000000000001",
      receiverId: "22222222-0000-0000-0000-000000000002",
      audioUrl: "https://cdn.test.com/audio.webm",
      durationSeconds: 15,
      status: "delivered",
      createdAt: new Date(),
    }]);
  });

  // Use valid UUIDs for userIds — VoiceMessageSchema.receiverId requires a UUID
  const VOICE_SENDER_UID = "11111111-0000-0000-0000-000000000001";
  const VOICE_RECEIVER_UID = "22222222-0000-0000-0000-000000000002";

  it("sends voice_message_received to receiver's socket", async () => {
    sender = createClient(VOICE_SENDER_UID);
    receiver = createClient(VOICE_RECEIVER_UID);
    await Promise.all([waitForConnect(sender), waitForConnect(receiver)]);

    const receiverServerSocketId = serverSocketIds.get(VOICE_RECEIVER_UID);
    expect(receiverServerSocketId).toBeTruthy();

    // Confirm socket is still connected on the server
    expect(io.sockets.sockets.has(receiverServerSocketId as string)).toBe(true);

    // Seed location store with verified server-side socket ID
    setDriverLocation(VOICE_RECEIVER_UID, {
      socketId: receiverServerSocketId as string,
      latitude: 48.8566,
      longitude: 2.3522,
      updatedAt: new Date(),
    });

    const voicePromise = waitForEvent<unknown>(receiver, "voice_message_received", 4000);
    let senderError: unknown = null;
    sender.once("error", (e) => { senderError = e; });

    // Sanity check: both connections are live before emitting
    expect(sender.connected).toBe(true);
    expect(receiver.connected).toBe(true);

    sender.emit("send_voice_message", {
      receiverId: VOICE_RECEIVER_UID,   // ← valid UUID required by schema
      audioUrl: "https://cdn.test.com/audio.webm",
      durationSeconds: 15,
    });

    // Give the async handler ~300ms to reach the DB call before checking
    await new Promise((r) => setTimeout(r, 300));
    // If handler ran and reached DB, mockDbInsert should have been called
    expect(senderError).toBeNull();
    expect(mockDbInsert).toHaveBeenCalled();

    const msg = await voicePromise;
    expect(msg).toBeTruthy();

    sender.disconnect();
    receiver.disconnect();
  });

  it("rejects invalid send_voice_message payload", async () => {
    sender = createClient("voice-sender-invalid");
    await waitForConnect(sender);

    const errPromise = waitForEvent<{ error: string }>(sender, "error");
    sender.emit("send_voice_message", { receiverId: "not-a-uuid", audioUrl: "bad", durationSeconds: 99 });

    const err = await errPromise;
    expect(err.error).toContain("Invalid");

    sender.disconnect();
  });
});

describe("send_stress_signal → stress_signal_alert", () => {
  let signalSender: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let nearbyDriver: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbReturning.mockResolvedValue([{
      id: "stress-uuid",
      userId: "stress-sender",
      latitude: 48.8566,
      longitude: 2.3522,
      status: "active",
      createdAt: new Date(),
    }]);
  });

  it("broadcasts stress_signal_alert to nearby connected drivers", async () => {
    signalSender = createClient("stress-sender");
    nearbyDriver = createClient("nearby-driver-stress");
    await Promise.all([waitForConnect(signalSender), waitForConnect(nearbyDriver)]);

    // Both broadcast location at same point (0 km apart = within radius)
    signalSender.emit("update_location", { latitude: 48.8566, longitude: 2.3522 });
    nearbyDriver.emit("update_location", { latitude: 48.8566, longitude: 2.3522 });
    await new Promise((r) => setTimeout(r, 150));

    const alertPromise = waitForEvent<unknown>(nearbyDriver, "stress_signal_alert");
    signalSender.emit("send_stress_signal", { latitude: 48.8566, longitude: 2.3522 });

    const alert = await alertPromise;
    expect(alert).toBeTruthy();

    signalSender.disconnect();
    nearbyDriver.disconnect();
  });

  it("rejects invalid send_stress_signal payload", async () => {
    signalSender = createClient("stress-invalid-sender");
    await waitForConnect(signalSender);

    const errPromise = waitForEvent<{ error: string }>(signalSender, "error");
    signalSender.emit("send_stress_signal", { latitude: 999, longitude: 999 });

    const err = await errPromise;
    expect(err.error).toContain("Invalid");

    signalSender.disconnect();
  });
});
