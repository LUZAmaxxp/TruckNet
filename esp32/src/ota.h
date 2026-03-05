#pragma once
void initOTA(const char* hostname);  // call once after WiFi connects
void handleOTA();                    // call every loop iteration
