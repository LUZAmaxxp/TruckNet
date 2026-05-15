#pragma once
#include <stdint.h>
void initWatchdog(uint32_t timeoutSeconds);  // must call in setup()
void feedWatchdog();                          // must call every loop iteration
void disableWatchdog();                       // call before OTA to prevent reset during flash
