import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api";
import { db } from "@/db";
import { behaviourScoringConfig } from "@/db/schema";
import { UpdateScoringConfigSchema } from "@/schemas/behaviour.schema";
import { DEFAULT_SCORING_CONFIG } from "@/lib/behaviour/gps-classifier";

/**
 * GET /api/admin/behaviour/config
 * Returns the active scoring config or factory defaults.
 *
 * PATCH /api/admin/behaviour/config
 * Body: UpdateScoringConfigSchema
 * Upserts into behaviourScoringConfig.
 *
 * Role: admin only
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();
  if (session.user.role !== "admin") return errorResponse("Forbidden", 403);

  const rows = await db
    .select()
    .from(behaviourScoringConfig)
    .limit(1);

  const config = rows[0] ?? DEFAULT_SCORING_CONFIG;

  return successResponse({ config }, 200);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth();
  if (session.user.role !== "admin") return errorResponse("Forbidden", 403);

  const body = await req.json().catch(() => null);
  const parsed = UpdateScoringConfigSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Validation failed", 400);

  const now = new Date();
  const data = parsed.data;

  // Map Zod snake_case → Drizzle camelCase DB columns
  const dbValues = {
    ...(data.harsh_braking_threshold_g      !== undefined && { harshBrakingThresholdG:      data.harsh_braking_threshold_g }),
    ...(data.harsh_acceleration_threshold_g !== undefined && { harshAccelerationThresholdG: data.harsh_acceleration_threshold_g }),
    ...(data.swerve_threshold_g             !== undefined && { swerveThresholdG:            data.swerve_threshold_g }),
    ...(data.speed_violation_excess_kmh     !== undefined && { speedViolationExcessKmh:     data.speed_violation_excess_kmh }),
    ...(data.idle_excess_minutes            !== undefined && { idleExcessMinutes:           data.idle_excess_minutes }),
    ...(data.ear_drowsy_threshold           !== undefined && { earDrowsyThreshold:          data.ear_drowsy_threshold }),
    ...(data.ear_microsleep_threshold       !== undefined && { earMicrosleepThreshold:      data.ear_microsleep_threshold }),
    ...(data.drowsy_duration_seconds        !== undefined && { drowsyDurationSeconds:       data.drowsy_duration_seconds }),
    ...(data.microsleep_duration_seconds    !== undefined && { microsleepDurationSeconds:   data.microsleep_duration_seconds }),
    ...(data.head_angle_distraction_deg     !== undefined && { headAngleDistractionDeg:     data.head_angle_distraction_deg }),
    ...(data.distraction_duration_seconds   !== undefined && { distractionDurationSeconds:  data.distraction_duration_seconds }),
    ...(data.weight_speed                   !== undefined && { weightSpeed:                 data.weight_speed }),
    ...(data.weight_driving_style           !== undefined && { weightDrivingStyle:          data.weight_driving_style }),
    ...(data.weight_fatigue                 !== undefined && { weightFatigue:               data.weight_fatigue }),
    ...(data.weight_idle                    !== undefined && { weightIdle:                  data.weight_idle }),
    ...(data.weight_sos                     !== undefined && { weightSos:                   data.weight_sos }),
    updatedAt: now,
  };

  // Try to update existing row first; if none exists, insert
  const existing = await db.select({ configId: behaviourScoringConfig.configId }).from(behaviourScoringConfig).limit(1);

  let upserted;
  if (existing.length > 0) {
    const [updated] = await db
      .update(behaviourScoringConfig)
      .set(dbValues)
      .returning();
    upserted = updated;
  } else {
    const [inserted] = await db
      .insert(behaviourScoringConfig)
      .values(dbValues)
      .returning();
    upserted = inserted;
  }

  return successResponse({ config: upserted }, 200);
}
