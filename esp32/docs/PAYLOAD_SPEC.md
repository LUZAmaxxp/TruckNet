# TruckNet MQTT Payload Specification

## Topic: `trucknet/sensors/{deviceId}/readings`
Publisher: ESP32 | QoS: 1 | Retained: false | Interval: 5s (configurable via command)

```json
{
  "deviceId": "truck-042",
  "ts": 1709577600000,
  "temperature_c": 4.2,
  "humidity_pct": 67.3,
  "vibration_magnitude": 0.043,
  "accel_x": 0.012,
  "accel_y": -0.008,
  "accel_z": 1.001,
  "firmware_version": "1.0.0"
}
```

| Field | Type | Range | Source |
|-------|------|-------|--------|
| deviceId | string | — | config.h DEVICE_ID |
| ts | number | Unix ms | NTP-synced, millis() fallback |
| temperature_c | float | -40 to 80 | DHT22, 1dp |
| humidity_pct | float | 0 to 100 | DHT22, 1dp |
| vibration_magnitude | float | 0 to 20 | sqrt(ax²+ay²+az²) in G, 3dp |
| accel_x/y/z | float | -8 to 8 | MPU6050 in G, 3dp |
| firmware_version | string | — | config.h FIRMWARE_VERSION |

## Topic: `trucknet/sensors/{deviceId}/status`
QoS: 1 | Retained: **true**
- Online (on connect): `{"deviceId":"truck-042","status":"online","ts":1709577600000}`
- Offline LWT (broker auto-publishes on disconnect): `{"deviceId":"truck-042","status":"offline","ts":1709577600000}`

## Topic: `trucknet/sensors/{deviceId}/command`
Publisher: server | Subscriber: ESP32
```json
{ "cmd": "set_interval", "intervalSeconds": 10 }
```
Clamps intervalSeconds between 1 and 60.
