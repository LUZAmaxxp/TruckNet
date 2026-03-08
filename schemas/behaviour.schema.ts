import { z } from "zod";

export const DrivingEventSchema = z.object({
  driver_id:             z.string().uuid(),
  trip_id:               z.string().uuid(),
  event_type:            z.enum([
    "speed_violation",
    "harsh_braking",
    "harsh_acceleration",
    "sudden_swerve",
    "drowsiness_alert",
    "microsleep_alert",
    "distraction_alert",
    "idle_excess",
    "sos_triggered",
  ]),
  severity:              z.enum(["low", "medium", "high", "critical"]),
  source:                z.enum(["gps", "esp32", "ai_camera", "driver"]),
  occurred_at:           z.number().positive(), // epoch ms
  duration_seconds:      z.number().nonnegative().optional(),
  gps_lat:               z.number().optional(),
  gps_lng:               z.number().optional(),
  gps_speed_kmh:         z.number().nonnegative().optional(),
  speed_limit_kmh:       z.number().nonnegative().optional(),
  speed_excess_kmh:      z.number().nonnegative().optional(),
  vibration_magnitude:   z.number().nonnegative().optional(),
  accel_x:               z.number().optional(),
  accel_y:               z.number().optional(),
  accel_z:               z.number().optional(),
  ear_value:             z.number().min(0).max(1).optional(),
  head_angle_deg:        z.number().optional(),
  confidence:            z.number().min(0).max(1).optional(),
  idle_duration_minutes: z.number().nonnegative().optional(),
  metadata:              z.record(z.unknown()).optional(),
});

export const UpdateScoringConfigSchema = z.object({
  harsh_braking_threshold_g:      z.number().positive().optional(),
  harsh_acceleration_threshold_g: z.number().positive().optional(),
  swerve_threshold_g:             z.number().positive().optional(),
  speed_violation_excess_kmh:     z.number().positive().optional(),
  idle_excess_minutes:            z.number().positive().optional(),
  ear_drowsy_threshold:           z.number().min(0).max(1).optional(),
  ear_microsleep_threshold:       z.number().min(0).max(1).optional(),
  drowsy_duration_seconds:        z.number().positive().optional(),
  microsleep_duration_seconds:    z.number().positive().optional(),
  head_angle_distraction_deg:     z.number().positive().optional(),
  distraction_duration_seconds:   z.number().positive().optional(),
  weight_speed:                   z.number().int().min(0).max(100).optional(),
  weight_driving_style:           z.number().int().min(0).max(100).optional(),
  weight_fatigue:                 z.number().int().min(0).max(100).optional(),
  weight_idle:                    z.number().int().min(0).max(100).optional(),
  weight_sos:                     z.number().int().min(0).max(100).optional(),
});

export type DrivingEventInput  = z.infer<typeof DrivingEventSchema>;
export type UpdateScoringConfig = z.infer<typeof UpdateScoringConfigSchema>;
