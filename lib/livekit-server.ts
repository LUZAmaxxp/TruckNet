import { AccessToken, RoomServiceClient, type VideoGrant } from "livekit-server-sdk";
import { env } from "@/lib/env";

/**
 * lib/livekit-server.ts
 *
 * Server-side LiveKit helpers.
 * NEVER import this in client components — LIVEKIT_API_SECRET must stay server-only.
 *
 * Token TTL is intentionally short (5 minutes) — enough to connect, not
 * enough to be replayed if intercepted.
 */

// 8 hours — covers a full truck shift without mid-call token expiry.
// The token is scoped to a single room and invalidated by status guard on the
// server when the call ends, so a long TTL carries no meaningful security risk.
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

/**
 * Convert a wss:// or ws:// URL to https:// or http://.
 * The RoomServiceClient uses the HTTP REST API, not WebSockets.
 */
function wsToHttp(url: string): string {
  return url.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
}

/**
 * Lazy singleton RoomServiceClient for server-side room management.
 */
let _roomService: RoomServiceClient | null = null;

export function getRoomService(): RoomServiceClient {
  if (!_roomService) {
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new Error("LiveKit environment variables are not configured.");
    }
    _roomService = new RoomServiceClient(
      wsToHttp(env.LIVEKIT_URL),
      env.LIVEKIT_API_KEY,
      env.LIVEKIT_API_SECRET
    );
  }
  return _roomService;
}

/**
 * generateLiveKitToken
 *
 * Creates a signed JWT scoped to a single LiveKit room.
 *
 * @param roomName  The LiveKit room name to grant access to
 * @param userId    The user's UUID (used as participant identity)
 * @param userName  Display name shown in the room
 * @param grants    Additional VideoGrant overrides (default: roomJoin + canPublish)
 */
export async function generateLiveKitToken(
  roomName: string,
  userId: string,
  userName: string,
  grants: Partial<VideoGrant> = {}
): Promise<string> {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new Error("LiveKit environment variables are not configured.");
  }
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: userId,
    name: userName,
    ttl: TOKEN_TTL_SECONDS,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    ...grants,
  });

  return at.toJwt();
}

