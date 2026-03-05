import { z } from "zod";

export const SensorReadingSchema = z.object({
  deviceId:            z.string().min(3).max(50),
  ts:                  z.number().positive(),
  temperature_c:       z.number().min(-40).max(80),
  humidity_pct:        z.number().min(0).max(100),
  vibration_magnitude: z.number().min(0).max(20),
  accel_x:             z.number(),
  accel_y:             z.number(),
  accel_z:             z.number(),
  firmware_version:    z.string().optional(),
});

export const SensorThresholdSchema = z
  .object({
    temp_min_c:       z.number().min(-40).max(80),
    temp_max_c:       z.number().min(-40).max(80),
    humidity_max_pct: z.number().min(0).max(100),
    vibration_max_g:  z.number().min(0).max(20),
  })
  .refine((d) => d.temp_min_c < d.temp_max_c, {
    message: "temp_min_c must be less than temp_max_c",
  });

export const DeviceRegisterSchema = z.object({
  deviceId:    z
    .string()
    .regex(/^[a-z0-9-]{3,50}$/, {
      message: "deviceId must be lowercase letters, numbers, hyphens only",
    }),
  truckLabel:  z.string().min(2).max(100),
  driverId:    z.string().uuid().optional(),
  alertConfig: SensorThresholdSchema.optional(),
});

export type SensorReading   = z.infer<typeof SensorReadingSchema>;
export type SensorThreshold = z.infer<typeof SensorThresholdSchema>;
export type DeviceRegister  = z.infer<typeof DeviceRegisterSchema>;

export const DEFAULT_ALERT_CONFIG: SensorThreshold = {
  temp_min_c:       2,
  temp_max_c:       8,
  humidity_max_pct: 85,
  vibration_max_g:  0.5,
};
