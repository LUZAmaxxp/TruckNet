import { type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth-helpers";
import { subscribeAdminSosStream } from "@/lib/admin-sos-stream";

/**
 * GET /api/admin/sos/stream
 *
 * Server-Sent Events endpoint that pushes new SOS alerts to the admin
 * dashboard in real time, sourced directly from the Kafka topic
 * "trucknet.stress-signals".
 *
 * Event format:
 *   data: {"type":"connected"}        — initial handshake on connect
 *   data: <AdminSosEntry JSON>        — new SOS alert (matches SosAdminEntry)
 *   : heartbeat                       — keepalive comment every 30 s
 *
 * The stream stays open until the client disconnects (page navigation,
 * tab close, etc.).  EventSource auto-reconnects on transient failures.
 */
export async function GET(req: NextRequest) {
  await requireAdminSession();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // Stream already closed — ignore
        }
      };

      // Initial handshake so the client can distinguish a live connection
      // from a reconnect that hasn't received any events yet
      write({ type: "connected" });

      const unsub = await subscribeAdminSosStream((alert) => {
        write(alert);
      });

      // Heartbeat: keeps the connection alive through proxies and load balancers
      // that close idle connections (SSE comments are ignored by EventSource)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Clean up when the admin navigates away / closes the tab
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // prevent nginx from buffering SSE frames
    },
  });
}
