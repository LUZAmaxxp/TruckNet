/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required to activate instrumentation.ts (auto-starts behaviour workers)
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Enforce HTTPS for 1 year, include subdomains, allow preload
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Disable browser features not needed by the app
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(self)",
          },
          // Content Security Policy
          // microphone=(self) allowed for voice recording via MediaRecorder API
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for styles in dev, hash-based in prod
              "style-src 'self' 'unsafe-inline'",
              // Next.js inline scripts + Socket.io client
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Allow connections to same origin (API, WS), Ably, and LiveKit WSS
              "connect-src 'self' ws://localhost:* wss://localhost:* ws: wss: https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://*.ably.net wss://*.ably.net https://main.realtime.ably.net wss://*.livekit.cloud https://*.livekit.cloud",
              // Allow audio blobs for voice message playback
              "media-src 'self' blob:",
              // Images: same origin + data URIs for avatars/icons + OpenStreetMap tiles
              "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
              // Fonts from same origin only
              "font-src 'self'",
              // Worker blobs for Next.js internals
              "worker-src 'self' blob:",
              // No framing allowed (redundant with X-Frame-Options but defence-in-depth)
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
