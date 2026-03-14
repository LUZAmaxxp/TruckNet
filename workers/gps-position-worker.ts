/**
 * workers/gps-position-worker.ts
 *
 * Alternative to the HTTP GPS endpoint: subscribes to MQTT topic
 *   trucknet/drivers/{driverId}/gps
 * and feeds position updates through the GPS classifier.
 *
 * Useful when the GPS module publishes via MQTT rather than HTTP POST.
 *
 * Start: npm run worker:gps
 */

import mqtt from "mqtt";
import { z } from "zod";
import { db } from "@/db";
import { transportTrips, gpsTracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { classifyGpsUpdate } from "@/lib/behaviour/gps-classifier";
import { loadScoringConfig } from "@/lib/behaviour/score-calculator";
import { getSpeedLimit } from "@/lib/behaviour/speed-limit-lookup";
import { ablyPublish } from "@/lib/ably-server";

const MQTT_URL = process.env.MQTT_URL!;

const GpsMqttSchema = z.object({
  trip_id:     z.string().uuid(),
  lat:         z.number().min(-90).max(90),
  lng:         z.number().min(-180).max(180),
  speed_kmh:   z.number().nonnegative(),
  heading_deg: z.number().optional(),
  timestamp:   z.number().positive(),
});

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId:        "gps-worker-" + Math.random().toString(16).slice(2),
  clean:           false,
  reconnectPeriod: 3_000,
  connectTimeout:  10_000,
});

mqttClient.on("connect", () => {
  console.log("[GPS Worker] Connected to MQTT broker");
  mqttClient.subscribe("trucknet/drivers/+/gps", { qos: 1 }, (err) => {
    if (err) console.error("[GPS Worker] Subscribe error:", err);
    else     console.log("[GPS Worker] Subscribed to trucknet/drivers/+/gps");
  });
});

mqttClient.on("error",     (err) => console.error("[GPS Worker] MQTT error:", err));
mqttClient.on("reconnect", ()    => console.log("[GPS Worker] Reconnecting..."));

mqttClient.on("message", (topic, payloadBuf) => {
  // topic: trucknet/drivers/{driverId}/gps
  const parts    = topic.split("/");
  const driverId = parts[2];

  void (async () => {
    try {
      const raw    = JSON.parse(payloadBuf.toString()) as unknown;
      const parsed = GpsMqttSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn("[GPS Worker] Invalid payload from", driverId, parsed.error.issues);
        return;
      }
      const d = parsed.data;

      // Verify trip is active for this driver
      const [trip] = await db
        .select({ id: transportTrips.id, status: transportTrips.status })
        .from(transportTrips)
        .where(and(eq(transportTrips.id, d.trip_id), eq(transportTrips.driverId, driverId)))
        .limit(1);

      if (!trip || trip.status !== "active") return;

      // Store track point
      await db.insert(gpsTracks).values({
        tripId:       d.trip_id,
        driverId,
        lat:          d.lat,
        lng:          d.lng,
        speedKmh:     d.speed_kmh,
        speedLimitKmh: null, // will be back-filled below after Overpass lookup
        headingDeg:   d.heading_deg ?? null,
        recordedAt:   new Date(d.timestamp),
      });

      // Classify
      const config = await loadScoringConfig();
      await classifyGpsUpdate(
        { driverId, tripId: d.trip_id, lat: d.lat, lng: d.lng, speedKmh: d.speed_kmh, timestamp: d.timestamp },
        config
      );

      // Speed limit lookup — classifyGpsUpdate already called getSpeedLimit, so
      // this returns instantly from the Redis cache (no extra Overpass request).
      const speedLimitKmh = await getSpeedLimit(d.lat, d.lng);

      // Live map broadcast
      await ablyPublish(`trips:${d.trip_id}`, "gps_update", {
        driverId,
        tripId:    d.trip_id,
        lat:       d.lat,
        lng:       d.lng,
        speedKmh:  d.speed_kmh,
        heading:   d.heading_deg,
        timestamp: d.timestamp,
      });

      // Speed limit update — delivered to driver's private channel
      await ablyPublish(`user:${driverId}`, "speed_limit_update", {
        speedLimitKmh,
        currentSpeedKmh: d.speed_kmh,
        isOverSpeeding:  speedLimitKmh !== null && d.speed_kmh > speedLimitKmh,
        roadName:        null,
        lat:             d.lat,
        lng:             d.lng,
        timestamp:       new Date(d.timestamp).toISOString(),
      });
    } catch (err) {
      console.error("[GPS Worker] Error processing", topic, err);
    }
  })();
});

// Graceful shutdown
process.on("SIGTERM", () => { mqttClient.end(); process.exit(0); });
process.on("SIGINT",  () => { mqttClient.end(); process.exit(0); });

console.log("[GPS Worker] starting...");
