#pragma once
#include <WiFi.h>
#include <PubSubClient.h>

extern unsigned long currentReadIntervalMs;  // modified by set_interval command

void initMqtt(WiFiClient& wc);   // sets up PubSubClient — does NOT connect
bool ensureConnected();          // reconnect with backoff — publishes online + subscribes on connect
bool publishReading(const String& payload);
bool publishStatus(const String& payload, bool retained);
void mqttLoop();                 // must be called every loop iteration
bool mqttConnected();
