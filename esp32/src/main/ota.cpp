#include "ota.h"
#include "config.h"
#include "watchdog.h"
#include <ArduinoOTA.h>

void initOTA(const char* hostname) {
  ArduinoOTA.setHostname(hostname);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([]() {
    disableWatchdog();  // prevent reset during flash
    Serial.println("[OTA] Starting update...");
  });
  ArduinoOTA.onEnd([]()   { Serial.println("\n[OTA] Done — rebooting"); });
  ArduinoOTA.onProgress([](unsigned int p, unsigned int t) {
    Serial.printf("[OTA] %u%%\r", (p * 100) / t);
  });
  ArduinoOTA.onError([](ota_error_t e) {
    Serial.println("[OTA][ERROR] " + String(e));
  });
  ArduinoOTA.begin();
  Serial.println("[OTA] Ready — hostname: " + String(hostname) + ".local");
}

void handleOTA() {
  ArduinoOTA.handle();
}
