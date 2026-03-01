import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Lightweight health check endpoint used by Docker HEALTHCHECK,
 * load balancers, and uptime monitors.
 *
 * Returns 200 with JSON payload when the Next.js process is alive.
 */
export async function GET() {
  const memoryMB = process.memoryUsage().rss / 1024 / 1024;

  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory_rss_mb: Math.round(memoryMB),
    },
    { status: 200 }
  );
}
