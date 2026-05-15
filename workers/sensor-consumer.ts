/**
 * workers/sensor-consumer.ts
 *
 * MQTT consumer that ingests IoT sensor readings from ESP32 devices.
 * Subscribes to:
 *   trucknet/sensors/+/readings  — full sensor bundle every ~5s
 *   trucknet/sensors/+/status    — online/offline LWT events
 *
 * For each reading:
 *   1. Validate with SensorReadingSchema (Zod)
 *   2. Persist to sensor_readings table
 *   3. Update iot_devices.last_seen_at + firmware_version
 *   4. Publish live reading to Ably channel sensors:{deviceId}
 *   5. Evaluate thresholds → insert sensor_alerts (with dedup)
 *   6. Fan-out alert to Ably channel admin:sensors
 *
 * Start: npm run worker:sensor
 * Dev:   tsx workers/sensor-consumer.ts
 */

import mqtt from "mqtt";
import Ably from "ably";
import { db } from "@/db";
import { iotDevices, sensorReadings, sensorAlerts, transportTrips } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { SensorReadingSchema } from "@/schemas/sensor.schema";
import {
  loadDeviceConfigs,
  evaluateThresholds,
  type AlertConfig,
} from "@/lib/sensor-thresholds";
import { DEFAULT_ALERT_CONFIG } from "@/schemas/sensor.schema";
import { classifyEsp32Reading } from "@/lib/behaviour/esp32-classifier";
import { loadScoringConfig } from "@/lib/behaviour/score-calculator";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MQTT_URL                  = process.env.MQTT_URL!;
const ABLY_API_KEY              = process.env.ABLY_API_KEY!;
const THRESHOLD_REFRESH_MS      = 5 * 60 * 1_000;   // refresh device configs every 5 min
const FLEET_SUMMARY_INTERVAL_MS = 10 * 1_000;         // broadcast fleet summary every 10s

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let deviceConfigs = new Map<string, AlertConfig>();

// Track last Ably publish time per alert id to throttle re-broadcasts
const alertLastPublished = new Map<string, number>();
const ALERT_REPUBLISH_INTERVAL_MS = 5 * 60 * 1_000; // re-publish every 5 min

// ---------------------------------------------------------------------------
// Ably REST client
// ---------------------------------------------------------------------------

const ably = new Ably.Rest({ key: ABLY_API_KEY });

async function ablyPublish(channel: string, event: string, data: unknown): Promise<void> {
  try {
    await ably.channels.get(channel).publish(event, data);
  } catch (err) {
    console.error(`[Ably] Failed to publish ${event} on ${channel}:`, err);
  }
}

// ---------------------------------------------------------------------------
// MQTT client
// ---------------------------------------------------------------------------

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId:        "sensor-worker-" + Math.random().toString(16).slice(2),
  clean:           false,    // persistent session — receive queued QoS 1 messages on reconnect
  reconnectPeriod: 3_000,
  connectTimeout:  10_000,
});

mqttClient.on("connect", () => {
  console.log("[MQTT] Connected to broker");
  mqttClient.subscribe("trucknet/sensors/+/readings", { qos: 1 }, (err) => {
    if (err) console.error("[MQTT] Subscribe readings error:", err);
    else     console.log("[MQTT] Subscribed to trucknet/sensors/+/readings");
  });
  mqttClient.subscribe("trucknet/sensors/+/status", { qos: 1 }, (err) => {
    if (err) console.error("[MQTT] Subscribe status error:", err);
    else     console.log("[MQTT] Subscribed to trucknet/sensors/+/status");
  });
});

mqttClient.on("error",      (err) => console.error("[MQTT] Error:", err));
mqttClient.on("reconnect",  ()    => console.log("[MQTT] Reconnecting..."));
mqttClient.on("disconnect", ()    => console.log("[MQTT] Disconnected"));

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

mqttClient.on("message", (topic, payloadBuf) => {
  const parts    = topic.split("/"); // ["trucknet","sensors","{deviceId}","readings|status"]
  const deviceId = parts[2];
  const msgType  = parts[3];

  void (async () => {
    try {
      const raw = JSON.parse(payloadBuf.toString()) as unknown;
      if (msgType === "readings") await handleReading(deviceId, raw);
      if (msgType === "status")   await handleStatus(deviceId, raw as { status: string; ts: number });
    } catch (err) {
      console.error(`[Worker] Failed to process ${topic}:`, err);
    }
  })();
});

// ---------------------------------------------------------------------------
// Readings handler
// ---------------------------------------------------------------------------

async function handleReading(deviceId: string, raw: unknown): Promise<void> {
  // 1. Validate
  const parsed = SensorReadingSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[Worker] Invalid reading from ${deviceId}:`, parsed.error.issues);
    return;
  }
  const data = parsed.data;

  console.log(`[Reading] ${deviceId} T:${data.temperature_c}°C H:${data.humidity_pct}% V:${data.vibration_magnitude}G`);

  // 2. Persist reading
  await db.insert(sensorReadings).values({
    deviceId,
    recordedAt:         new Date(data.ts),
    temperatureC:       data.temperature_c,
    humidityPct:        data.humidity_pct,
    vibrationMagnitude: data.vibration_magnitude,
    accelX:             data.accel_x,
    accelY:             data.accel_y,
    accelZ:             data.accel_z,
  });

  // 3. Update device last_seen_at + firmware_version
  await db
    .update(iotDevices)
    .set({ lastSeenAt: new Date(), firmwareVersion: data.firmware_version ?? null })
    .where(eq(iotDevices.deviceId, deviceId));

  // 4. Publish live reading to admin dashboard
  await ablyPublish(`sensors:${deviceId}`, "sensor_reading", {
    deviceId,
    recordedAt:          new Date(data.ts).toISOString(),
    temperatureC:        data.temperature_c,
    humidityPct:         data.humidity_pct,
    vibrationMagnitude:  data.vibration_magnitude,
  });

  // 5. Evaluate thresholds
  const config   = deviceConfigs.get(deviceId) ?? DEFAULT_ALERT_CONFIG;
  const breaches = evaluateThresholds(data, config);

  // 6. Insert alerts with deduplication — prevent alert storms
  for (const breach of breaches) {
    // Fetch device info once per breach (needed for both new and existing paths)
    const [device] = await db
      .select({ truckLabel: iotDevices.truckLabel, driverId: iotDevices.driverId })
      .from(iotDevices)
      .where(eq(iotDevices.deviceId, deviceId))
      .limit(1);

    const existing = await db
      .select({ id: sensorAlerts.id, driverId: sensorAlerts.driverId, triggeredAt: sensorAlerts.triggeredAt })
      .from(sensorAlerts)
      .where(
        and(
          eq(sensorAlerts.deviceId,  deviceId),
          eq(sensorAlerts.alertType, breach.type),
          eq(sensorAlerts.status,    "active")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const existingAlert = existing[0]!;

      // Update stored value so the admin panel shows current severity
      const updates: Record<string, unknown> = { value: breach.value };

      // If a driver was linked AFTER this alert was created, backfill driverId
      const driverJustLinked = device?.driverId && existingAlert.driverId === null;
      if (driverJustLinked) updates.driverId = device!.driverId;

      await db
        .update(sensorAlerts)
        .set(updates)
        .where(eq(sensorAlerts.id, existingAlert.id));

      // Re-publish every 5 min so the driver keeps seeing the alert
      const lastPublished = alertLastPublished.get(existingAlert.id) ?? 0;
      const msSinceLast   = Date.now() - lastPublished;
      const shouldRepublish = driverJustLinked || msSinceLast >= ALERT_REPUBLISH_INTERVAL_MS;

      console.log(`[Dedup] ${breach.type} on ${deviceId}: lastPublished=${lastPublished === 0 ? "never" : Math.round(msSinceLast / 1000) + "s ago"} shouldRepublish=${shouldRepublish}`);

      if (shouldRepublish) {
        alertLastPublished.set(existingAlert.id, Date.now());
        console.warn(`[Republish] ${breach.type} on ${deviceId}: ${breach.value} > ${breach.threshold}`);

        await ablyPublish("admin:sensors", "sensor_alert", {
          alertId:     existingAlert.id,
          deviceId,
          truckLabel:  device?.truckLabel ?? deviceId,
          alertType:   breach.type,
          value:       breach.value,
          threshold:   breach.threshold,
          triggeredAt: existingAlert.triggeredAt.toISOString(),
        });

        if (device?.driverId) {
          await ablyPublish(`user:${device.driverId}`, "sensor_alert_driver", {
            alertId:     existingAlert.id,
            deviceId,
            truckLabel:  device.truckLabel ?? deviceId,
            alertType:   breach.type,
            value:       breach.value,
            threshold:   breach.threshold,
            triggeredAt: existingAlert.triggeredAt.toISOString(),
          });
        }
      }

      continue; // already alerting — skip inserting a new row
    }

    const [newAlert] = await db
      .insert(sensorAlerts)
      .values({
        deviceId,
        driverId:    device?.driverId ?? null,
        alertType:   breach.type,
        value:       breach.value,
        threshold:   breach.threshold,
        triggeredAt: new Date(),
      })
      .returning();

    await ablyPublish("admin:sensors", "sensor_alert", {
      alertId:     newAlert.id,
      deviceId,
      truckLabel:  device?.truckLabel ?? deviceId,
      alertType:   breach.type,
      value:       breach.value,
      threshold:   breach.threshold,
      triggeredAt: newAlert.triggeredAt.toISOString(),
    });

    // Fan-out the same alert to the driver's personal channel so the
    // driver app can show an in-cab warning toast / notification.
    if (device?.driverId) {
      await ablyPublish(`user:${device.driverId}`, "sensor_alert_driver", {
        alertId:     newAlert.id,
        deviceId,
        truckLabel:  device.truckLabel ?? deviceId,
        alertType:   breach.type,
        value:       breach.value,
        threshold:   breach.threshold,
        triggeredAt: newAlert.triggeredAt.toISOString(),
      });
    }

    console.warn(`[Alert] ${breach.type} on ${deviceId}: ${breach.value} > ${breach.threshold}`);
  }

  // ── FEAT-009: classify ESP32 reading for behaviour events ─────────────────
  // Find the driver's active trip (if any) via the device→driver link
  const [device] = await db
    .select({ driverId: iotDevices.driverId })
    .from(iotDevices)
    .where(eq(iotDevices.deviceId, deviceId))
    .limit(1);

  if (device?.driverId) {
    const [activeTrip] = await db
      .select({ id: transportTrips.id })
      .from(transportTrips)
      .where(
        and(
          eq(transportTrips.driverId, device.driverId),
          eq(transportTrips.status, "active")
        )
      )
      .limit(1);

    if (activeTrip) {
      const bConfig = await loadScoringConfig();
      await classifyEsp32Reading(
        {
          driverId:           device.driverId,
          tripId:             activeTrip.id,
          vibrationMagnitude: data.vibration_magnitude,
          accelX:             data.accel_x,
          accelY:             data.accel_y,
          accelZ:             data.accel_z,
          timestamp:          data.ts,
        },
        bConfig
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Status handler
// ---------------------------------------------------------------------------

async function handleStatus(
  deviceId: string,
  raw: { status: string; ts: number }
): Promise<void> {
  const status = raw.status === "online" ? "online" : "offline";

  await db
    .update(iotDevices)
    .set({ status, lastSeenAt: new Date(raw.ts) })
    .where(eq(iotDevices.deviceId, deviceId));

  await ablyPublish(`sensors:${deviceId}`, "device_status", {
    deviceId,
    status,
    at: new Date(raw.ts).toISOString(),
  });

  console.log(`[Status] ${deviceId} → ${status}`);
}

// ---------------------------------------------------------------------------
// Fleet summary broadcast (every 10s)
// ---------------------------------------------------------------------------

async function broadcastFleetSummary(): Promise<void> {
  try {
    const devices = await db
      .select({
        deviceId:        iotDevices.deviceId,
        truckLabel:      iotDevices.truckLabel,
        status:          iotDevices.status,
        lastSeenAt:      iotDevices.lastSeenAt,
        firmwareVersion: iotDevices.firmwareVersion,
      })
      .from(iotDevices);

    // Enrich each device with its latest reading and active alert count
    const enriched = await Promise.all(
      devices.map(async (device) => {
        const [latestReading] = await db
          .select({
            temperatureC:       sensorReadings.temperatureC,
            humidityPct:        sensorReadings.humidityPct,
            vibrationMagnitude: sensorReadings.vibrationMagnitude,
            recordedAt:         sensorReadings.recordedAt,
          })
          .from(sensorReadings)
          .where(eq(sensorReadings.deviceId, device.deviceId))
          .orderBy(desc(sensorReadings.recordedAt))
          .limit(1);

        const [alertRow] = await db
          .select({ count: count() })
          .from(sensorAlerts)
          .where(
            and(
              eq(sensorAlerts.deviceId, device.deviceId),
              eq(sensorAlerts.status, "active")
            )
          );

        return {
          deviceId:        device.deviceId,
          truckLabel:      device.truckLabel,
          status:          device.status,
          lastSeenAt:      device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
          firmwareVersion: device.firmwareVersion ?? null,
          activeAlertCount: alertRow?.count ?? 0,
          latestReading: latestReading
            ? {
                temperatureC:       latestReading.temperatureC,
                humidityPct:        latestReading.humidityPct,
                vibrationMagnitude: latestReading.vibrationMagnitude,
                recordedAt:         latestReading.recordedAt.toISOString(),
              }
            : null,
        };
      })
    );

    // Wrap in { devices } to match FleetSensorUpdatePayload type
    await ablyPublish("admin:sensors", "fleet_sensor_update", { devices: enriched });
  } catch (err) {
    console.error("[Worker] Fleet summary error:", err);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[Worker] sensor-consumer starting...");

  deviceConfigs = await loadDeviceConfigs();
  console.log(`[Worker] Loaded configs for ${deviceConfigs.size} devices`);

  // Refresh threshold configs every 5 minutes
  setInterval(() => {
    void loadDeviceConfigs().then((configs) => {
      deviceConfigs = configs;
      console.log(`[Worker] Refreshed configs for ${deviceConfigs.size} devices`);
    });
  }, THRESHOLD_REFRESH_MS);

  // Fleet summary broadcast every 10s
  setInterval(() => void broadcastFleetSummary(), FLEET_SUMMARY_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Worker] SIGTERM — shutting down");
    mqttClient.end();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    console.log("[Worker] SIGINT — shutting down");
    mqttClient.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
