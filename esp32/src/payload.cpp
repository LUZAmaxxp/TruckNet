#include "payload.h"
#include "config.h"
#include <ArduinoJson.h>
#include <time.h>

static bool          ntpSynced  = false;
static time_t        bootEpoch  = 0;
static unsigned long bootMs     = 0;

void syncNTP() {
  Serial.print("[NTP] Syncing");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  struct tm ti;
  int retries = 0;
  while (!getLocalTime(&ti) && retries < 20) { delay(500); Serial.print("."); retries++; }
  if (retries < 20) {
    bootEpoch = time(nullptr); bootMs = millis(); ntpSynced = true;
    Serial.println(" OK: " + String((long)bootEpoch));
  } else {
    Serial.println(" FAILED — using millis() fallback");
  }
}

unsigned long long getCurrentEpochMs() {
  if (ntpSynced) return ((unsigned long long)bootEpoch * 1000ULL) + (millis() - bootMs);
  return (unsigned long long)millis();
}

String buildReadingPayload(const SensorBundle& b) {
  StaticJsonDocument<512> doc;
  doc["deviceId"]             = DEVICE_ID;
  doc["ts"]                   = getCurrentEpochMs();
  doc["temperature_c"]        = round(b.dht.temperature_c * 10.0f) / 10.0f;
  doc["humidity_pct"]         = round(b.dht.humidity_pct  * 10.0f) / 10.0f;
  doc["vibration_magnitude"]  = round(b.vibration_magnitude * 1000.0f) / 1000.0f;
  doc["accel_x"]              = round(b.mpu.accel_x * 1000.0f) / 1000.0f;
  doc["accel_y"]              = round(b.mpu.accel_y * 1000.0f) / 1000.0f;
  doc["accel_z"]              = round(b.mpu.accel_z * 1000.0f) / 1000.0f;
  doc["firmware_version"]     = FIRMWARE_VERSION;
  String out; serializeJson(doc, out); return out;
}

String buildStatusPayload(const char* status) {
  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID; doc["status"] = status; doc["ts"] = getCurrentEpochMs();
  String out; serializeJson(doc, out); return out;
}

String buildLwtPayload() { return buildStatusPayload("offline"); }
