/**
 * lib/behaviour/esp32-classifier.ts
 *
 * Classifies ESP32 sensor readings into driving events.
 * Called from the sensor-consumer worker for every reading that has an
 * associated active trip.
 */

import { db } from "@/db";
import { drivingEvents, type BehaviourScoringConfig } from "@/db/schema";
import { safeGet, safeSet } from "@/lib/redis";

export interface Esp32Reading {
  driverId:           string;
  tripId:             string;
  vibrationMagnitude: number;
  accelX:             number;
  accelY:             number;
  accelZ:             number;
  timestamp:          number; // epoch ms
}

async function isDuplicate(tripId: string, eventType: string): Promise<boolean> {
  const key = `event_dedup:${tripId}:${eventType}`;
  const existing = await safeGet(key);
  if (existing) return true;
  await safeSet(key, "1", 10); // 10s dedup window
  return false;
}

export async function classifyEsp32Reading(
  reading: Esp32Reading,
  config:  BehaviourScoringConfig
): Promise<void> {
  const { driverId, tripId, vibrationMagnitude, accelX, accelY, accelZ, timestamp } = reading;
  const now = new Date(timestamp);

  // ── Harsh braking ──────────────────────────────────────────────────────────
  // ESP32 is oriented with Z axis along the direction of travel.
  // Sharp deceleration → accelZ drops below 1g.
  const isHarshBraking =
    accelZ < 1.0 - config.harshBrakingThresholdG &&
    vibrationMagnitude > config.harshBrakingThresholdG;

  if (isHarshBraking && !(await isDuplicate(tripId, "harsh_braking"))) {
    await db.insert(drivingEvents).values({
      driverId,
      tripId,
      eventType:          "harsh_braking",
      severity:           vibrationMagnitude > 0.7 ? "high" : "medium",
      source:             "esp32",
      occurredAt:         now,
      vibrationMagnitude,
      accelX,
      accelY,
      accelZ,
    });
  }

  // ── Harsh acceleration ─────────────────────────────────────────────────────
  const isHarshAccel = accelZ > 1.0 + config.harshAccelerationThresholdG;

  if (isHarshAccel && !(await isDuplicate(tripId, "harsh_acceleration"))) {
    await db.insert(drivingEvents).values({
      driverId,
      tripId,
      eventType:          "harsh_acceleration",
      severity:           "low",
      source:             "esp32",
      occurredAt:         now,
      vibrationMagnitude,
      accelX,
      accelY,
      accelZ,
    });
  }

  // ── Sudden swerve ──────────────────────────────────────────────────────────
  const lateralG = Math.sqrt(accelX * accelX + accelY * accelY);

  if (lateralG > config.swerveThresholdG && !(await isDuplicate(tripId, "sudden_swerve"))) {
    const severity =
      lateralG > 0.6 ? "high" :
      lateralG > 0.4 ? "medium" : "low";

    await db.insert(drivingEvents).values({
      driverId,
      tripId,
      eventType:          "sudden_swerve",
      severity,
      source:             "esp32",
      occurredAt:         now,
      vibrationMagnitude,
      accelX,
      accelY,
      accelZ,
    });
  }
}
