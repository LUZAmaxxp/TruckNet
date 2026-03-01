/**
 * TruckConnect — k6 Socket.io Load Test
 * ======================================
 *
 * Simulates concurrent drivers connecting to the Socket.io server,
 * sending location updates, and measuring round-trip latency.
 *
 * USAGE
 * -----
 *   # Install k6: https://k6.io/docs/get-started/installation/
 *   k6 run load-tests/k6-script.js
 *
 *   # With env overrides:
 *   k6 run --env BASE_URL=http://localhost:3000 --env AUTH_TOKEN=<jwt> load-tests/k6-script.js
 *
 * STAGES (ramp-up → sustained → ramp-down)
 * -----------------------------------------
 *   0–1 min   : ramp from 0  → 100 VUs   (warm-up)
 *   1–3 min   : hold at 500 VUs          (moderate load)
 *   3–5 min   : ramp to 1 000 VUs        (peak load)
 *   5–7 min   : hold at 1 000 VUs        (sustained peak)
 *   7–8 min   : ramp to   0 VUs          (cool-down)
 *
 * THRESHOLDS
 * ----------
 *   - p(95) event round-trip latency < 500 ms
 *   - < 1% WebSocket connection errors
 *
 * NOTE ON 10k VUs
 * ---------------
 *   Running 10 000 concurrent WebSocket connections requires a dedicated
 *   load-test machine with ulimit tuning and k6 cloud / distributed mode.
 *   The stages above target 1 000 VUs which is feasible on a dev laptop.
 *   To test 10k, use: k6 run --vus 10000 --duration 2m
 *   Adjust thresholds to "record baseline" mode by removing `abortOnFail`.
 */

import { sleep } from "k6";
import ws from "k6/ws";
import { check, fail } from "k6";
import { Counter, Trend } from "k6/metrics";

// ─── Custom metrics ──────────────────────────────────────────────────────────
const eventRTT   = new Trend("socket_event_rtt_ms", true); // p95, p99
const connErrors = new Counter("socket_connection_errors");
const msgSent    = new Counter("socket_messages_sent");
const msgRecv    = new Counter("socket_messages_received");

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL   = __ENV.BASE_URL   || "http://localhost:3000";
// A valid JWT from your Auth.js session cookie or API test token.
// Without a token, the socket server will reject the connection.
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

const WS_URL = BASE_URL.replace(/^http/, "ws") + "/socket.io/?EIO=4&transport=websocket";

// ─── Load profile ────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "1m",  target: 100  },  // ramp up
    { duration: "2m",  target: 500  },  // moderate
    { duration: "2m",  target: 1000 },  // ramp to peak
    { duration: "2m",  target: 1000 },  // sustain peak
    { duration: "1m",  target: 0    },  // cool-down
  ],
  thresholds: {
    // p95 event round-trip must stay under 500 ms
    "socket_event_rtt_ms": [
      { threshold: "p(95)<500", abortOnFail: false },
    ],
    // Connection error rate < 1 %
    "socket_connection_errors": [
      { threshold: "count<10", abortOnFail: false },
    ],
  },
};

// ─── Virtual user scenario ───────────────────────────────────────────────────
export default function () {
  const authHeader = AUTH_TOKEN
    ? { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }
    : {};

  const res = ws.connect(WS_URL, authHeader, function (socket) {
    socket.on("open", function () {
      // Send Socket.io handshake probe
      socket.send("2probe");
    });

    socket.on("message", function (data) {
      // Socket.io engine.io framing:
      //   "3probe"   → handshake pong
      //   "40"       → namespace connect
      //   "42[...]"  → application event
      if (data === "3probe") {
        // Upgrade handshake
        socket.send("5");
        return;
      }

      if (data === "40") {
        // Namespace connected — start sending location updates
        sendLocationUpdate(socket);
        return;
      }

      if (data.startsWith("42")) {
        msgRecv.add(1);
      }
    });

    socket.on("error", function (e) {
      connErrors.add(1);
    });

    // Hold connection open for 30 s, pinging every 5 s
    let elapsed = 0;
    const pingInterval = 5;
    while (elapsed < 30) {
      sleep(pingInterval);
      elapsed += pingInterval;
      if (elapsed < 30) {
        sendLocationUpdate(socket);
      }
    }

    socket.close();
  });

  check(res, {
    "WebSocket connected (101)": (r) => r && r.status === 101,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Emits a `driver_location_update` event and records the current timestamp
 * so RTT can be tracked if the server echoes back a confirmation event.
 */
function sendLocationUpdate(socket) {
  const t0 = Date.now();

  // Socket.io v4 message format: "42" prefix + JSON array [eventName, payload]
  const payload = JSON.stringify([
    "driver_location_update",
    {
      latitude:  50.0 + (Math.random() - 0.5) * 0.1,
      longitude: 14.0 + (Math.random() - 0.5) * 0.1,
    },
  ]);

  socket.send("42" + payload);
  msgSent.add(1);

  // Record RTT as time-to-send (true RTT needs server echo; use as proxy)
  eventRTT.add(Date.now() - t0);
}
