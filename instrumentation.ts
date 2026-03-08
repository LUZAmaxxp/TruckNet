/**
 * instrumentation.ts
 *
 * Next.js instrumentation hook — runs once on server startup.
 * Webpack compiles this for BOTH the Node.js and Edge runtimes, so
 * Node.js built-ins (child_process, path) must live in a separate
 * file that is only ever imported inside the nodejs runtime guard.
 *
 * Actual worker-spawning logic is in instrumentation.node.ts.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
