#pragma once
#include "sensors.h"
#include <Arduino.h>

void           syncNTP();                                     // call once after WiFi connects
unsigned long long getCurrentEpochMs();                       // NTP epoch ms, falls back to millis()
String         buildReadingPayload(const SensorBundle& b);    // main sensor JSON payload
String         buildStatusPayload(const char* status);        // online/offline status payload
String         buildLwtPayload();                             // LWT offline payload (same as offline status)
