import { getAblyRest } from "@/lib/ably-server";
import { requireAuth } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";

/**
 * GET /api/auth/ably-token
 *
 * Returns a short-lived Ably TokenRequest signed with the server API key.
 * The `clientId` is set to the authenticated user's UUID so Ably can
 * identify which user a connection belongs to — enabling per-user channel targeting.
 *
 * Used by the `useSocket` hook as the `authUrl` passed to `Ably.Realtime`.
 * Ably automatically calls this endpoint to refresh tokens before they expire.
 */
export async function GET() {
  const session = await requireAuth();

  const tokenRequest = await getAblyRest().auth.createTokenRequest({
    clientId: session.user.id,
    capability: {
      // Driver-specific private channel — receives friend/voice/stress events
      [`user:${session.user.id}`]: ["subscribe", "publish", "presence"],
      // Shared presence channel for driver location tracking
      "drivers:locations": ["subscribe", "publish", "presence"],
      // Shared broadcast channels
      "stress:alerts": ["subscribe", "publish"],
      // Sensor device channels — admin dashboard live readings
      "sensors:*": ["subscribe"],
    },
  });

  return NextResponse.json(tokenRequest);
}
