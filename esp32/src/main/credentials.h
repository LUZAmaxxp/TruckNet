#pragma once

// ── WiFi Networks ────────────────────────────────────────────────────────────
// Add every SSID/password pair the truck may encounter (depot, hotspot, etc.).
// The firmware will scan and connect to whichever has the strongest signal.
struct WifiCredential { const char* ssid; const char* password; };

static const WifiCredential WIFI_NETWORKS[] = {
  { "Orange_wifi_982D", "FmF549qge6e"  },   // depot / home router
  { "MyHotspot",         "20040428"   },   // phone hotspot
  // { "AnotherSSID",    "itsPassword" }, // add more as needed
};
static const int WIFI_NETWORK_COUNT =
  (int)(sizeof(WIFI_NETWORKS) / sizeof(WIFI_NETWORKS[0]));

// MQTT broker credentials — must match Mosquitto passwd file
#define MQTT_USERNAME     "trucknet"
#define MQTT_PASSWORD     "TruckMQTT2024@@"

// OTA password — used to push firmware updates over WiFi after first flash
#define OTA_PASSWORD      "your-ota-password"
