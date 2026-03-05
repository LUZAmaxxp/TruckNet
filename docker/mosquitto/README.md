# Mosquitto MQTT Broker

## Generating the passwd file

The `passwd` file stores hashed MQTT credentials.
Generate it with:

```bash
# Run once — replace YOUR_PASSWORD with the value from your .env MQTT_PASSWORD
docker run --rm eclipse-mosquitto:2 \
  mosquitto_passwd -b /dev/stdout trucknet YOUR_PASSWORD > docker/mosquitto/passwd
```

Commit the generated `passwd` file (it contains only the hash, not the plain password).

## Topic structure

| Topic | Publisher | Subscriber | Notes |
|-------|-----------|------------|-------|
| trucknet/sensors/{deviceId}/readings | ESP32 | sensor-worker | QoS 1, every 5s |
| trucknet/sensors/{deviceId}/status | ESP32 + broker LWT | sensor-worker | QoS 1, retained |
| trucknet/sensors/{deviceId}/command | sensor-worker | ESP32 | QoS 1 |

## Test connectivity

```bash
# Subscribe to all sensor topics
docker exec -it trucknet-mosquitto \
  mosquitto_sub -h localhost -t 'trucknet/sensors/#' \
  -u trucknet -P YOUR_PASSWORD -v

# Publish a test message
docker exec -it trucknet-mosquitto \
  mosquitto_pub -h localhost -t 'trucknet/sensors/truck-001/readings' \
  -m '{"deviceId":"truck-001","ts":1000,"temperature_c":4.2,"humidity_pct":67.3,"vibration_magnitude":0.04,"accel_x":0.01,"accel_y":-0.01,"accel_z":1.0}' \
  -u trucknet -P YOUR_PASSWORD
```
