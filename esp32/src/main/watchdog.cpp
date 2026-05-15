#include "watchdog.h"
#include <Arduino.h>
#include <esp_task_wdt.h>

void initWatchdog(uint32_t s) {
  // Deinit first — reconfigure fails silently if the task isn't already
  // subscribed, leaving the default IDF timeout (~5s) active instead of ours.
  esp_task_wdt_deinit();

  esp_task_wdt_config_t wdt_config = {
    .timeout_ms     = s * 1000,
    .idle_core_mask = 0,
    .trigger_panic  = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);  // subscribe main task
  Serial.println("[WDT] Watchdog armed — " + String(s) + "s timeout");
}
void feedWatchdog()    { esp_task_wdt_reset(); }
void disableWatchdog() { esp_task_wdt_delete(NULL); }
