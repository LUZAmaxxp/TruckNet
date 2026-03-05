// ─────────────────────────────────────────────────────────────────────────────
//  TruckNet ESP32 Firmware — main.ino
//  Reads DHT22 + MPU6050 every READ_INTERVAL_MS
//  Publishes JSON to MQTT broker (Mosquitto)
//  Connects to: trucknet/sensors/{DEVICE_ID}/readings
// ─────────────────────────────────────────────────────────────────────────────

#include "config.h"
#include "sensors.h"
#include "payload.h"
#include "mqtt_client.h"
#include "ota.h"
#include "watchdog.h"
#include <WiFi.h>

static WiFiClient    wifiClient;
static unsigned long lastReadTime   = 0;
static unsigned long lastStatusTime = 0;
static bool          sensorsOk      = false;

// ── WiFi ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("[WiFi] Connecting to " + String(WIFI_SSID));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < WIFI_MAX_RETRIES) {
    delay(WIFI_RECONNECT_INTERVAL_MS); Serial.print("."); retries++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi][ERROR] Failed — restarting in 5s");
    delay(5000); ESP.restart();
  }
  Serial.println("\n[WiFi] Connected: " + WiFi.localIP().toString());
}

// ── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("┌──────────────────────────────────────┐");
  Serial.println("│  TruckNet ESP32  v" + String(FIRMWARE_VERSION) + "              │");
  Serial.println("│  Device: " + String(DEVICE_ID) + "                    │");
  Serial.println("└──────────────────────────────────────┘");

  initWatchdog(WATCHDOG_TIMEOUT_SECONDS);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // LED on during boot

  connectWiFi();
  syncNTP();
  initOTA(DEVICE_ID);

  sensorsOk = initSensors();
  if (!sensorsOk) Serial.println("[WARN] Sensor init failed — will retry in loop");

  initMqtt(wifiClient);
  ensureConnected();

  digitalWrite(LED_PIN, LOW);  // LED off = ready
  Serial.println("[TruckNet] Operational. Publishing every " + String(READ_INTERVAL_MS / 1000) + "s");
}

// ── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
  feedWatchdog();
  handleOTA();

  // WiFi guard
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost connection — reconnecting");
    connectWiFi();
    return;
  }

  // MQTT guard
  if (!ensureConnected()) { delay(500); return; }
  mqttLoop();

  unsigned long now = millis();

  // ── Sensor read + publish ─────────────────────────────────────────────────
  if (now - lastReadTime >= currentReadIntervalMs) {
    lastReadTime = now;

    if (!sensorsOk) { sensorsOk = initSensors(); }

    SensorBundle bundle = readAll();

    if (bundle.dht.valid && bundle.mpu.valid) {
      String payload = buildReadingPayload(bundle);
      bool   ok      = publishReading(payload);

      if (ok) {
        if (LED_BLINK_ON_PUBLISH) { digitalWrite(LED_PIN, HIGH); delay(30); digitalWrite(LED_PIN, LOW); }
        Serial.println("[READ] T:" + String(bundle.dht.temperature_c, 1) +
                       "C  H:" + String(bundle.dht.humidity_pct, 1) +
                       "%  V:" + String(bundle.vibration_magnitude, 3) + "G");
      } else {
        Serial.println("[READ][WARN] Publish failed");
      }
    } else {
      Serial.println("[READ][WARN] Sensor read failed — skipping");
    }
  }

  // ── Heartbeat status publish ──────────────────────────────────────────────
  if (now - lastStatusTime >= STATUS_PUBLISH_INTERVAL_MS) {
    lastStatusTime = now;
    publishStatus(buildStatusPayload("online"), true);
  }
}
