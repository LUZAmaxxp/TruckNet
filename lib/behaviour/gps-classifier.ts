/**
 * lib/behaviour/gps-classifier.ts
 *
 * Classifies GPS position updates into driving events (speed violation,
 * idle excess, harsh braking via GPS delta).
 *
 * Called on every GPS update — inserts rows into driving_events table.
 */

import { db } from "@/db";
import { drivingEvents, type BehaviourScoringConfig } from "@/db/schema";
import { safeGet, safeSet, safeDel } from "@/lib/redis";
import { getSpeedLimit } from "./speed-limit-lookup";

export interface GpsUpdate {
  driverId:   string;
  tripId:     string;
  lat:        number;
  lng:        number;
  speedKmh:   number;
  headingDeg?: number;
  timestamp:  number; // epoch ms
}

/** Default scoring config used when no DB config exists */
export const DEFAULT_SCORING_CONFIG: BehaviourScoringConfig = {
  configId:                    "default",
  harshBrakingThresholdG:      0.4,
  harshAccelerationThresholdG: 0.35,
  swerveThresholdG:            0.3,
  speedViolationExcessKmh:     10,
  idleExcessMinutes:           10,
  earDrowsyThreshold:          0.25,
  earMicrosleepThreshold:      0.20,
  drowsyDurationSeconds:       2.0,
  microsleepDurationSeconds:   3.0,
  headAngleDistractionDeg:     30,
  distractionDurationSeconds:  3.0,
  weightSpeed:                 25,
  weightDrivingStyle:          20,
  weightFatigue:               30,
  weightIdle:                  10,
  weightSos:                   15,
  deductionSpeedMinor:         5,
  deductionSpeedMajor:         10,
  deductionHarshBraking:       3,
  deductionHarshAcceleration:  3,
  deductionSwerve:             5,
  deductionDrowsiness:         15,
  deductionMicrosleep:         25,
  deductionDistraction:        8,
  deductionIdlePer10min:       2,
  deductionSos:                20,
  createdAt:                   new Date(),
  updatedAt:                   new Date(),
  createdBy:                   null,
};

export async function classifyGpsUpdate(
  update: GpsUpdate,
  config: BehaviourScoringConfig
): Promise<void> {
  const { driverId, tripId, lat, lng, speedKmh, timestamp } = update;
  const now = new Date(timestamp);

  // ── 1. Speed violation ─────────────────────────────────────────────────────
  const speedLimit = await getSpeedLimit(lat, lng);
  if (speedLimit !== null && speedKmh > speedLimit + config.speedViolationExcessKmh) {
    const excess = speedKmh - speedLimit;
    const severity =
      excess < 20 ? "medium" :
      excess < 40 ? "high"   : "critical";

    await db.insert(drivingEvents).values({
      driverId,
      tripId,
      eventType:      "speed_violation",
      severity,
      source:         "gps",
      occurredAt:     now,
      gpsLat:         lat,
      gpsLng:         lng,
      gpsSpeedKmh:    speedKmh,
      speedLimitKmh:  speedLimit,
      speedExcessKmh: excess,
    });
  }

  // ── 2. Idle detection ──────────────────────────────────────────────────────
  const idleKey    = `idle:${tripId}`;
  const idleFlagKey = `idle_flagged:${tripId}`;

  if (speedKmh < 2) {
    const idleStartStr = await safeGet(idleKey);
    if (!idleStartStr) {
      await safeSet(idleKey, String(timestamp), 60 * 60 * 4); // 4h max
    } else {
      const idleStart   = parseInt(idleStartStr, 10);
      const idleMinutes = (timestamp - idleStart) / 60_000;
      const alreadyFlagged = await safeGet(idleFlagKey);

      if (idleMinutes > config.idleExcessMinutes && !alreadyFlagged) {
        await db.insert(drivingEvents).values({
          driverId,
          tripId,
          eventType:           "idle_excess",
          severity:            "low",
          source:              "gps",
          occurredAt:          now,
          gpsLat:              lat,
          gpsLng:              lng,
          idleDurationMinutes: idleMinutes,
        });
        // Mark flagged so we don't double-insert for the same idle session
        await safeSet(idleFlagKey, "1", 60 * 60 * 4);
      }
    }
  } else {
    // Moving — clear idle state
    await safeDel(idleKey);
    await safeDel(idleFlagKey);
  }

  // ── 3. Harsh braking (GPS speed delta) ────────────────────────────────────
  const prevKey = `prev_speed:${tripId}`;
  const prevStr = await safeGet(prevKey);

  if (prevStr) {
    const [prevSpeed, prevTs] = prevStr.split(":").map(Number);
    const timeDeltaSeconds = (timestamp - prevTs) / 1_000;

    if (timeDeltaSeconds > 0 && timeDeltaSeconds < 30) {
      const speedDelta    = prevSpeed - speedKmh; // positive = deceleration
      const decelKmhPerSec = speedDelta / timeDeltaSeconds;

      if (decelKmhPerSec > 15) {
        // Dedup: avoid double-insert if ESP32 also fires for same event
        const dedupKey = `event_dedup:${tripId}:harsh_braking`;
        const alreadyFired = await safeGet(dedupKey);
        if (!alreadyFired) {
          await db.insert(drivingEvents).values({
            driverId,
            tripId,
            eventType:  "harsh_braking",
            severity:   "high",
            source:     "gps",
            occurredAt: now,
            gpsLat:     lat,
            gpsLng:     lng,
            gpsSpeedKmh: speedKmh,
          });
          await safeSet(dedupKey, "1", 10);
        }
      }
    }
  }

  await safeSet(prevKey, `${speedKmh}:${timestamp}`, 60); // expire after 60s
}
