# TruckNet ESP32 Firmware

Standalone firmware for the ESP32 DevKit V1 installed in each truck container.
Reads temperature, humidity, and vibration every 5 seconds.
Publishes JSON via MQTT to the TruckNet Mosquitto broker.

```
ESP32 → MQTT (Mosquitto) → sensor-consumer worker → PostgreSQL + Ably → Admin Dashboard
```

## Hardware BOM (~$16 total vs $70+ for Raspberry Pi)

| Component | Qty | ~Cost |
|-----------|-----|-------|
| ESP32 DevKit V1 | 1 | $7 |
| DHT22 (AM2302) | 1 | $4 |
| MPU6050 GY-521 | 1 | $2 |
| 10kΩ resistor | 1 | $0.10 |
| Breadboard + wires | 1 | $3 |

## Quick Start (5 steps)

1. **Wire sensors** → `docs/WIRING.md`
2. **Install Arduino IDE + libraries** → `docs/SETUP.md`
3. **Configure credentials**:
   ```bash
   cp esp32/config/credentials.example.h esp32/config/credentials.h
   # Edit credentials.h with your WiFi + MQTT passwords
   ```
4. **Set device ID** in `src/config.h` → `#define DEVICE_ID "truck-001"`
5. **Register + flash** → `docs/SETUP.md` steps 6–9

## Files

```
esp32/
├── src/
│   ├── main.ino          ← entry point (setup + loop)
│   ├── config.h          ← all configuration (edit before flashing)
│   ├── sensors.h/cpp     ← DHT22 + MPU6050 drivers
│   ├── payload.h/cpp     ← JSON builder (matches backend SensorReadingSchema)
│   ├── mqtt_client.h/cpp ← MQTT with LWT + reconnect + command handler
│   ├── ota.h/cpp         ← OTA firmware updates over WiFi
│   └── watchdog.h/cpp    ← hardware watchdog (auto-reboot on stall)
├── config/
│   ├── credentials.example.h  ← COMMITTED template
│   └── credentials.h          ← GITIGNORED (your real secrets)
├── docs/
│   ├── WIRING.md
│   ├── SETUP.md
│   ├── PAYLOAD_SPEC.md
│   └── TROUBLESHOOTING.md
├── tools/
│   ├── test_mqtt.py      ← subscribe + pretty-print all sensor readings
│   └── monitor.py        ← colored serial monitor with timestamps
├── platformio.ini        ← PlatformIO alternative to Arduino IDE
├── libraries.txt         ← required libraries + install commands
└── README.md
```

## Troubleshooting → `docs/TROUBLESHOOTING.md`
