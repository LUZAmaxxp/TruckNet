/**
 * instrumentation.node.ts
 *
 * Node.js-only worker spawner — imported exclusively from
 * instrumentation.ts inside a `NEXT_RUNTIME === "nodejs"` guard.
 *
 * Webpack never compiles this for the Edge runtime, so Node.js
 * built-ins (child_process, path) are safe to use here at the
 * top level.
 *
 * Workers auto-started:
 *   - behaviour-event-consumer.ts  (MQTT → driving_events)
 *   - behaviour-report-worker.ts   (BullMQ → behaviour_reports)
 *
 * Each worker is restarted on crash (3 s back-off).
 * In production use the docker-compose services instead.
 */

import { spawn } from "node:child_process";
import path from "node:path";

// Prevent double-spawn in Next.js dev mode, which may call register() more
// than once across the server / route-compiler invocations.
if (!process.env.__BEHAVIOUR_WORKERS_STARTED) {
  process.env.__BEHAVIOUR_WORKERS_STARTED = "1";

  const RESTART_DELAY_MS = 3_000;

  const WORKERS: Array<{ name: string; script: string }> = [
    {
      name: "behaviour-event-consumer",
      script: "workers/behaviour-event-consumer.ts",
    },
    {
      name: "behaviour-report-worker",
      script: "workers/behaviour-report-worker.ts",
    },
  ];

  const spawnWorker = (name: string, script: string) => {
    const scriptPath = path.join(process.cwd(), script);

    // `shell: true` is required on Windows so Node can execute the
    // tsx.cmd shim in node_modules/.bin without an ENOENT error.
    const child = spawn("npx", ["tsx", scriptPath], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
      cwd: process.cwd(),
    });

    child.on("error", (err) => {
      console.error(`[workers] Failed to start ${name}:`, err.message);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        console.log(`[workers] ${name} exited cleanly.`);
        return;
      }
      console.warn(
        `[workers] ${name} exited (code=${code}, signal=${signal}). ` +
          `Restarting in ${RESTART_DELAY_MS / 1000}s…`
      );
      setTimeout(() => spawnWorker(name, script), RESTART_DELAY_MS);
    });

    console.log(`[workers] Started ${name} (pid=${child.pid})`);
  }

  for (const { name, script } of WORKERS) {
    spawnWorker(name, script);
  }
}
