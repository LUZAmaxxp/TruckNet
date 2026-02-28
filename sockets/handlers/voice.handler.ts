import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";
import { VoiceMessageSchema } from "@/schemas/voice.schema";
import { validateSocketEvent } from "@/lib/validate";
import { db } from "@/db";
import { voiceMessages } from "@/db/schema";
import { getDriverLocation } from "@/sockets/store/location.store";

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * registerVoiceHandler
 *
 * Handles the `send_voice_message` client event.
 *
 * Steps:
 *   1. Validate payload with VoiceMessageSchema
 *   2. Persist voice message row (status='delivered') to voice_messages table
 *   3. Look up receiver's socketId from the in-memory location store
 *   4. Emit `voice_message_received` to receiver's socket with message metadata
 */
export function registerVoiceHandler(io: IO, socket: TSocket): void {
  socket.on("send_voice_message", async (payload: unknown) => {
    const result = validateSocketEvent(VoiceMessageSchema, payload);

    if (!result.ok) {
      socket.emit("error", {
        error: "Invalid voice message payload",
        details: result.error,
      });
      return;
    }

    const { receiverId, audioUrl, durationSeconds } = result.data;
    const senderId = socket.data.userId;

    try {
      // 1. Persist to database
      const [message] = await db
        .insert(voiceMessages)
        .values({
          senderId,
          receiverId,
          audioUrl,
          durationSeconds,
          status: "delivered",
        })
        .returning();

      if (!message) {
        socket.emit("error", { error: "Failed to save voice message" });
        return;
      }

      // 2. Look up receiver's live socket via the location store
      const receiverEntry = getDriverLocation(receiverId);

      // 3. Emit to receiver if they are online
      if (receiverEntry?.socketId) {
        io.to(receiverEntry.socketId).emit("voice_message_received", {
          id: message.id,
          senderId,
          audioUrl: message.audioUrl,
          durationSeconds: message.durationSeconds,
          createdAt: message.createdAt,
        });
      }
      // If the receiver is offline the message is safely persisted and retrievable
      // via GET /api/voice-messages when they reconnect.
    } catch (err) {
      console.error("[voice.handler] DB error:", err);
      socket.emit("error", { error: "Internal error while saving voice message" });
    }
  });
}
