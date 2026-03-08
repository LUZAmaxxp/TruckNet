/**
 * workers/behaviour-event-consumer.ts
 *
 * MQTT worker subscribing to camera AI behaviour events from cam_agent.
 * Topic: trucknet/drivers/+/behaviour
 *
 * For each message:
 *   1. Parse + validate with DrivingEventSchema
 *   2. Verify tripId belongs to the driverId in topic (security)
 *   3. INSERT into driving_events
 *   4. If severity = 'critical' | 'high': fan-out to Ably admin:behaviour
 *   5. Microsleep → extra Ably channel alert
 *
 * Start: npm run worker:behaviour-events
 */

import mqtt from "mqtt";
import { db } from "@/db";
import { drivingEvents, transportTrips } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { DrivingEventSchema } from "@/schemas/behaviour.schema";
import { ablyPublish } from "@/lib/ably-server";

const MQTT_URL = process.env.MQTT_URL!;

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId:        "behaviour-event-consumer-" + Math.random().toString(16).slice(2),
  clean:           false,
  reconnectPeriod: 3_000,
  connectTimeout:  10_000,
});

mqttClient.on("connect", () => {
  console.log("[behaviour-consumer] Connected to MQTT broker");
  mqttClient.subscribe("trucknet/drivers/+/behaviour", { qos: 1 }, (err) => {
    if (err) console.error("[behaviour-consumer] Subscribe error:", err);
    else     console.log("[behaviour-consumer] Subscribed to trucknet/drivers/+/behaviour");
  });
});

mqttClient.on("error",     (err) => console.error("[behaviour-consumer] MQTT error:", err));
mqttClient.on("reconnect", ()    => console.log("[behaviour-consumer] Reconnecting..."));

mqttClient.on("message", (topic, payloadBuf) => {
  // topic: trucknet/drivers/{driverId}/behaviour
  const parts           = topic.split("/");
  const topicDriverId   = parts[2];

  void (async () => {
    try {
      const raw    = JSON.parse(payloadBuf.toString()) as unknown;
      const parsed = DrivingEventSchema.safeParse(raw);

      if (!parsed.success) {
        console.warn("[behaviour-consumer] Invalid payload:", parsed.error.issues);
        return;
      }

      const d = parsed.data;

      // Security: driverId in topic must match payload
      if (d.driver_id !== topicDriverId) {
        console.warn("[behaviour-consumer] driverId mismatch — dropping");
        return;
      }

      // Verify trip belongs to this driver and is active
      const [trip] = await db
        .select({
          id:       transportTrips.id,
          status:   transportTrips.status,
          driverId: transportTrips.driverId,
        })
        .from(transportTrips)
        .where(
          and(
            eq(transportTrips.id,       d.trip_id),
            eq(transportTrips.driverId, d.driver_id),
          )
        )
        .limit(1);

      if (!trip) {
        console.warn(`[behaviour-consumer] Trip ${d.trip_id} not found for driver ${d.driver_id}`);
        return;
      }

      // INSERT event
      await db.insert(drivingEvents).values({
        driverId:            d.driver_id,
        tripId:              d.trip_id,
        eventType:           d.event_type,
        severity:            d.severity,
        source:              d.source,
        occurredAt:          new Date(d.occurred_at),
        durationSeconds:     d.duration_seconds     ?? null,
        gpsLat:              d.gps_lat              ?? null,
        gpsLng:              d.gps_lng              ?? null,
        gpsSpeedKmh:         d.gps_speed_kmh        ?? null,
        speedLimitKmh:       d.speed_limit_kmh      ?? null,
        speedExcessKmh:      d.speed_excess_kmh     ?? null,
        vibrationMagnitude:  d.vibration_magnitude  ?? null,
        accelX:              d.accel_x              ?? null,
        accelY:              d.accel_y              ?? null,
        accelZ:              d.accel_z              ?? null,
        earValue:            d.ear_value            ?? null,
        headAngleDeg:        d.head_angle_deg       ?? null,
        confidence:          d.confidence           ?? null,
        idleDurationMinutes: d.idle_duration_minutes ?? null,
        metadata:            d.metadata             ?? null,
      });

      console.log(`[behaviour-consumer] ${d.event_type} sev=${d.severity} trip=${d.trip_id}`);

      // Fan-out high/critical events to admin live feed
      if (d.severity === "critical" || d.severity === "high") {
        await ablyPublish("admin:behaviour", "behaviour_alert", {
          driverId:   d.driver_id,
          tripId:     d.trip_id,
          eventType:  d.event_type,
          severity:   d.severity,
          occurredAt: new Date(d.occurred_at).toISOString(),
          gpsLat:     d.gps_lat,
          gpsLng:     d.gps_lng,
          earValue:   d.ear_value,
          confidence: d.confidence,
        });
      }

      // Extra microsleep alert to trip channel (for in-trip real-time warning)
      if (d.event_type === "microsleep_alert") {
        await ablyPublish(`trips:${d.trip_id}`, "microsleep_alert", {
          driverId:  d.driver_id,
          severity:  "critical",
          earValue:  d.ear_value,
          occurredAt: new Date(d.occurred_at).toISOString(),
        });
      }
    } catch (err) {
      console.error("[behaviour-consumer] Error processing message:", err);
    }
  })();
});

// Graceful shutdown
process.on("SIGTERM", () => { mqttClient.end(); process.exit(0); });
process.on("SIGINT",  () => { mqttClient.end(); process.exit(0); });

console.log("[behaviour-consumer] starting...");
