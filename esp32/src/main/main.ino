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
  WiFi.persistent(false);
  WiFi.disconnect(true, true);
  delay(500);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  delay(100);
  feedWatchdog();

  // ── Scan for all known networks ───────────────────────────────────────────
  Serial.printf("[WiFi] Scanning for %d known network(s)...\n", WIFI_NETWORK_COUNT);
  int n = WiFi.scanNetworks(false, true);
  feedWatchdog();

  // Match scan results against WIFI_NETWORKS[]
  struct Match { int credIdx; int rssi; int channel; uint8_t bssid[6]; };
  Match matches[16];   // enough for any realistic scan
  int   matchCount = 0;

  for (int i = 0; i < n && matchCount < 16; i++) {
    for (int c = 0; c < WIFI_NETWORK_COUNT; c++) {
      if (WiFi.SSID(i) == String(WIFI_NETWORKS[c].ssid)) {
        Match& m  = matches[matchCount++];
        m.credIdx = c;
        m.rssi    = WiFi.RSSI(i);
        m.channel = WiFi.channel(i);
        memcpy(m.bssid, WiFi.BSSID(i), 6);
        Serial.printf("[WiFi] Found '%s' — RSSI:%d dBm  Ch:%d  BSSID:%02X:%02X:%02X:%02X:%02X:%02X\n",
          WIFI_NETWORKS[c].ssid, m.rssi, m.channel,
          m.bssid[0], m.bssid[1], m.bssid[2], m.bssid[3], m.bssid[4], m.bssid[5]);
        break;
      }
    }
  }
  WiFi.scanDelete();

  if (matchCount == 0) {
    Serial.println("[WiFi] No known networks in range — restarting in 5s");
    delay(5000);
    ESP.restart();
  }

  // Sort by RSSI descending so we try the strongest signal first
  for (int i = 0; i < matchCount - 1; i++) {
    for (int j = 0; j < matchCount - i - 1; j++) {
      if (matches[j].rssi < matches[j + 1].rssi) {
        Match tmp = matches[j]; matches[j] = matches[j + 1]; matches[j + 1] = tmp;
      }
    }
  }

  // ── Try each matched network in order ────────────────────────────────────
  for (int m = 0; m < matchCount; m++) {
    const char* ssid     = WIFI_NETWORKS[matches[m].credIdx].ssid;
    const char* password = WIFI_NETWORKS[matches[m].credIdx].password;

    Serial.printf("[WiFi] Connecting to '%s'\n", ssid);
    feedWatchdog();
    WiFi.begin(ssid, password, matches[m].channel, matches[m].bssid);

    int retries = 0;
    bool wrongPass = false;
    while (WiFi.status() != WL_CONNECTED && retries < WIFI_MAX_RETRIES) {
      for (int i = 0; i < (WIFI_RECONNECT_INTERVAL_MS / 500); i++) {
        delay(500);
        feedWatchdog();
      }
      retries++;
      wl_status_t s = WiFi.status();
      if (retries % 5 == 0) {
        Serial.println(" [retry=" + String(retries) + " status=" + String((int)s) + "]");
      } else {
        Serial.print(".");
      }
      if (s == WL_CONNECT_FAILED) {
        Serial.printf("\n[WiFi] Wrong password for '%s' — skipping\n", ssid);
        wrongPass = true;
        break;
      }
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n[WiFi] Connected to '" + String(ssid) + "': " + WiFi.localIP().toString());
      return;  // success
    }

    WiFi.disconnect(true);
    delay(300);
    feedWatchdog();
  }

  Serial.println("[WiFi] All known networks failed — restarting");
  delay(2000);
  ESP.restart();
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
  feedWatchdog();  // reset timer immediately after arming
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
