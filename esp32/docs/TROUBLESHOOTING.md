# TruckNet ESP32 — Troubleshooting

## WiFi not connecting
- Check WIFI_SSID and WIFI_PASSWORD in credentials.h (exact case, no extra spaces)
- Ensure the truck WiFi/hotspot is on 2.4GHz — ESP32 does NOT support 5GHz
- Check WIFI_MAX_RETRIES in config.h — increase to 40 in low-signal environments

## MQTT connection failed (rc=-2)
- rc=-2 = broker unreachable. Check MQTT_BROKER_HOST IP/domain in config.h
- Verify Mosquitto is running: `docker ps | grep mosquitto`
- Check firewall: port 1883 must be open between truck network and server
- Test from laptop: `mosquitto_sub -h HOST -t 'test' -u trucknet -P PASSWORD`

## MQTT connection failed (rc=4 or rc=5)
- rc=4/5 = authentication failed. Check MQTT_USERNAME and MQTT_PASSWORD match Mosquitto passwd file
- Regenerate passwd: see docker/mosquitto/README.md

## DHT22 read failed
- Check wiring: DATA pin → GPIO4, 10kΩ pull-up between VCC and DATA
- DHT22 needs 1–2s between reads — already handled by retry logic

## MPU6050 not found
- Check wiring: SDA→GPIO21, SCL→GPIO22, VCC→3.3V (NOT 5V), AD0→GND
- Check I2C address: AD0→GND = 0x68, AD0→3.3V = 0x69
- Run I2C scanner sketch to confirm address

## Readings not appearing in admin dashboard
- Check sensor-consumer worker is running: `docker logs sensor-worker -f`
- Check ABLY_API_KEY is set in sensor-worker container environment
- Verify device is registered: `SELECT * FROM iot_devices WHERE device_id='truck-042'`

## Payload too large / truncated
- Ensure MQTT_MAX_PACKET_SIZE is 512 in config.h (not the default 256)
- `client.setBufferSize(512)` must be called — already done in mqtt_client.cpp
