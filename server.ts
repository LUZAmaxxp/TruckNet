/**
 * server.ts — TruckConnect custom HTTP server
 *
 * Runs both Next.js (HTTP) and Socket.io (WebSocket) on the same port so
 * authenticated sessions and cookies are shared without CORS issues.
 *
 * Start dev:  npm run dev      → tsx watch server.ts
 * Start prod: npm run start:server → tsx server.ts
 *
 * Environment (validated at startup by /lib/env.ts EnvSchema):
 *   SOCKET_PORT    — Port for the combined HTTP + WS server (default: 3000)
 *   NEXTAUTH_URL   — Allowed CORS origin for Socket.io
 *   NEXTAUTH_SECRET — JWT secret for socket auth middleware
 *   DATABASE_URL   — PostgreSQL connection string
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { env } from "./lib/env";
import { initSocketServer } from "./sockets/index";

const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(env.SOCKET_PORT, 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.io to the same HTTP server — shares port with Next.js
  initSocketServer(httpServer, env.NEXTAUTH_URL);

  httpServer.listen(PORT, () => {
    console.log(`> TruckConnect ready on http://localhost:${PORT}`);
    console.log(`> Socket.io listening on ws://localhost:${PORT}`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});
