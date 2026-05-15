#pragma once

// credentials.h is gitignored — copy from credentials.example.h
#include "credentials.h"

// ─────────────────────────────────────────────────────────────────────────────
//  TruckNet ESP32 — Central Configuration
//  CHANGE DEVICE_ID and MQTT_BROKER_HOST before flashing each unit.
// ─────────────────────────────────────────────────────────────────────────────

// ── DEVICE (change per unit) ──────────────────────────────────────────────────
// Must match a row registered in iot_devices table via POST /api/admin/sensors/{deviceId}/register
// Format: lowercase, numbers, hyphens only. Examples: truck-001, truck-042
#define DEVICE_ID           "truck-001"
#define FIRMWARE_VERSION    "1.0.0"

// ── BROKER (change to your server IP or domain) ───────────────────────────────
// Docker internal: use service name 'mosquitto' inside compose network
// External access: your server's public IP or domain, e.g. "mqtt.mydomain.com"
#define MQTT_BROKER_HOST        "192.168.100.14"
#define MQTT_BROKER_PORT        1883
#define MQTT_QOS                1
#define MQTT_KEEPALIVE_SECONDS  60
#define MQTT_RECONNECT_DELAY_MS 3000
#define MQTT_MAX_PACKET_SIZE    512  // default 256 is too small for our payload

// ── WIFI ─────────────────────────────────────────────────────────────────────
#define WIFI_RECONNECT_INTERVAL_MS  5000
#define WIFI_MAX_RETRIES            20

// ── PINS ─────────────────────────────────────────────────────────────────────
#define DHT_PIN             4      // DHT22 data → GPIO4 (with 10kΩ pull-up to 3.3V)
#define DHT_TYPE            DHT11
#define MPU_SDA_PIN         21     // MPU6050 SDA → GPIO21
#define MPU_SCL_PIN         22     // MPU6050 SCL → GPIO22
#define LED_PIN             2      // onboard LED — most ESP32 DevKit V1 boards
#define LED_BLINK_ON_PUBLISH true  // blink on every successful MQTT publish

// ── TIMING ───────────────────────────────────────────────────────────────────
#define READ_INTERVAL_MS            5000   // sensor read + MQTT publish interval
#define STATUS_PUBLISH_INTERVAL_MS  30000  // heartbeat 'online' status
#define WATCHDOG_TIMEOUT_SECONDS    30     // hardware reset if loop stalls

// ── LOCAL THRESHOLDS (onboard LED warning only) ───────────────────────────────
// Server-side thresholds in iot_devices.alert_config are authoritative for admin alerts.
#define TEMP_WARN_MAX_C        8.0f
#define TEMP_WARN_MIN_C        2.0f
#define HUMIDITY_WARN_MAX_PCT  85.0f
#define VIBRATION_WARN_MAX_G   0.5f
