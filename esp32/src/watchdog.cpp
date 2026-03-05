#include "watchdog.h"
#include <esp_task_wdt.h>

void initWatchdog(uint32_t s) {
  esp_task_wdt_init(s, true);   // true = panic (reboot) on timeout
  esp_task_wdt_add(NULL);       // watch main task
  Serial.println("[WDT] Watchdog armed — " + String(s) + "s timeout");
}
void feedWatchdog()    { esp_task_wdt_reset(); }
void disableWatchdog() { esp_task_wdt_delete(NULL); }
