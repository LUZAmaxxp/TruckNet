import Ably from "ably";
import { env } from "@/lib/env";

/**
 * Ably REST client singleton — used server-side only (API routes, server components).
 *
 * Do NOT import this in client components or hooks.
 * For client-side real-time connections use the `useAbly` hook (hooks/useSocket.ts).
 *
 * Channel naming conventions:
 *   "user:<userId>"   — per-user private channel (friend requests, voice message alerts)
 *   "drivers"         — shared channel for nearby driver broadcasts
 *   "stress"          — shared channel for stress signal alerts
 */

let _ablyRest: Ably.Rest | null = null;

export function getAblyRest(): Ably.Rest {
  if (!_ablyRest) {
    _ablyRest = new Ably.Rest({ key: env.ABLY_API_KEY });
  }
  return _ablyRest;
}

/**
 * Publish a message on an Ably channel from server-side code.
 * Swallows errors gracefully — real-time delivery is best-effort;
 * the primary data path is the HTTP response.
 */
export async function ablyPublish(
  channelName: string,
  eventName: string,
  data: unknown
): Promise<void> {
  try {
    const rest = getAblyRest();
    await rest.channels.get(channelName).publish(eventName, data);
  } catch (err) {
    console.error(`[ably-server] publish failed on "${channelName}/${eventName}":`, err);
  }
}
