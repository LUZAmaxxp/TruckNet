#pragma once

// ─────────────────────────────────────────────────────────────────────────────
//  TruckNet ESP32 — Credentials Template
//
//  1. Copy this file:  cp credentials.example.h credentials.h
//  2. Fill in your real values in credentials.h
//  3. credentials.h is in .gitignore — it will never be committed
// ─────────────────────────────────────────────────────────────────────────────

// WiFi network the truck connects to (hotspot or depot WiFi)
#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"

// MQTT broker credentials — must match Mosquitto passwd file
// Get MQTT_PASSWORD from your server .env file
#define MQTT_USERNAME     "trucknet"
#define MQTT_PASSWORD     "YOUR_MQTT_PASSWORD"

// OTA password — used to push firmware updates over WiFi after first flash
#define OTA_PASSWORD      "YOUR_OTA_PASSWORD"
