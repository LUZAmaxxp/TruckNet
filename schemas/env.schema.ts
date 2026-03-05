import { z } from "zod";

/**
 * EnvSchema — validates all required environment variables at application startup.
 * Application must fail fast with a descriptive ZodError if any variable is
 * missing or malformed. Import `env` from /lib/env.ts — never access process.env directly.
 */
export const EnvSchema = z.object({
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  NEXTAUTH_SECRET: z
    .string()
    .min(10, { message: "NEXTAUTH_SECRET must be at least 10 characters" }),
  NEXTAUTH_URL: z
    .string()
    .url({ message: "NEXTAUTH_URL must be a valid URL" }),
  SOCKET_PORT: z.string({ required_error: "SOCKET_PORT is required" }).optional(),
  ABLY_API_KEY: z.string().min(1, { message: "ABLY_API_KEY is required" }),
  // LiveKit – WebRTC SFU for voice/video calls (Next.js app only, not required by workers)
  LIVEKIT_URL: z.string().url({ message: "LIVEKIT_URL must be a valid URL (e.g. wss://livekit.yourdomain.com)" }).optional(),
  LIVEKIT_API_KEY: z.string().min(1, { message: "LIVEKIT_API_KEY is required" }).optional(),
  LIVEKIT_API_SECRET: z.string().min(1, { message: "LIVEKIT_API_SECRET is required" }).optional(),
  // Kafka – message queue for critical notifications (SOS alerts, etc.)
  // Comma-separated list of broker addresses, e.g. "kafka:9092" or
  // "broker1:9092,broker2:9092" for multi-broker production clusters.
  // Defaults to "localhost:9092" for local development without Docker.
  KAFKA_BROKERS: z.string().min(1).default("localhost:9092"),
  KAFKA_ENABLED: z.enum(["true", "false"]).default("false"),
  // Admin invite code — required when role=admin is submitted during registration
  ADMIN_INVITE_CODE: z.string().min(8).optional(),
  // Redis — optional; enables OSRM route result caching for performance.
  // When unset, all route requests go directly to OSRM (correct but slower).
  REDIS_URL: z.string().url().optional(),
  // MQTT — Eclipse Mosquitto broker for IoT sensor data ingestion
  // Optional in local dev: only required when running the sensor-consumer worker.
  MQTT_URL:      z.string().url({ message: "MQTT_URL must be a valid URL, e.g. mqtt://trucknet:password@localhost:1883" }).optional(),
  MQTT_PASSWORD: z.string().min(8, { message: "MQTT_PASSWORD must be at least 8 characters" }).optional(),
});

export type Env = z.infer<typeof EnvSchema>;
