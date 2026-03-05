import { db } from "@/db";
import { iotDevices } from "@/db/schema";
import { DEFAULT_ALERT_CONFIG, type SensorThreshold } from "@/schemas/sensor.schema";

export type AlertType = "temp_high" | "temp_low" | "humidity_high" | "vibration_high";

export interface ThresholdBreach {
  type:      AlertType;
  value:     number;
  threshold: number;
}

export type AlertConfig = SensorThreshold;

/**
 * Load all device alert configs into a Map.
 * Called on worker startup and refreshed every 5 minutes.
 */
export async function loadDeviceConfigs(): Promise<Map<string, AlertConfig>> {
  const devices = await db
    .select({ deviceId: iotDevices.deviceId, alertConfig: iotDevices.alertConfig })
    .from(iotDevices);

  const map = new Map<string, AlertConfig>();
  for (const device of devices) {
    const config = (device.alertConfig as AlertConfig) ?? DEFAULT_ALERT_CONFIG;
    map.set(device.deviceId, config);
  }
  return map;
}

/**
 * Evaluate a sensor reading against thresholds.
 * Returns an array of breaches (can be multiple per reading).
 * Empty array = no breach.
 */
export function evaluateThresholds(
  reading: { temperature_c: number; humidity_pct: number; vibration_magnitude: number },
  config:  AlertConfig
): ThresholdBreach[] {
  const breaches: ThresholdBreach[] = [];

  if (reading.temperature_c > config.temp_max_c) {
    breaches.push({ type: "temp_high", value: reading.temperature_c, threshold: config.temp_max_c });
  }
  if (reading.temperature_c < config.temp_min_c) {
    breaches.push({ type: "temp_low", value: reading.temperature_c, threshold: config.temp_min_c });
  }
  if (reading.humidity_pct > config.humidity_max_pct) {
    breaches.push({ type: "humidity_high", value: reading.humidity_pct, threshold: config.humidity_max_pct });
  }
  if (reading.vibration_magnitude > config.vibration_max_g) {
    breaches.push({ type: "vibration_high", value: reading.vibration_magnitude, threshold: config.vibration_max_g });
  }

  return breaches;
}
