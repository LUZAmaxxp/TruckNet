#include "sensors.h"
#include "config.h"
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <math.h>

static DHT             dht(DHT_PIN, DHT_TYPE);
static Adafruit_MPU6050 mpu;
static bool            mpuReady = false;

bool initSensors() {
  Serial.println("[Sensors] Initializing...");
  dht.begin();
  Serial.println("[Sensors] DHT11 ready on GPIO" + String(DHT_PIN));

  Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
  if (!mpu.begin()) {
    Serial.println("[Sensors][ERROR] MPU6050 not found — check wiring: SDA→GPIO21, SCL→GPIO22, VCC→3.3V, AD0→GND");
    mpuReady = false;
    return false;
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // Warm-up: discard first 10 readings
  Serial.print("[Sensors] MPU6050 warm-up");
  for (int i = 0; i < 10; i++) {
    sensors_event_t a, g, t; mpu.getEvent(&a, &g, &t); delay(50); Serial.print(".");
  }
  Serial.println(" done");

  mpuReady = true;
  return true;
}

DHT22Reading readDHT22() {
  for (int i = 0; i < 3; i++) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) return { t, h, true };
    if (i < 2) { Serial.println("[Sensors][WARN] DHT22 retry " + String(i+1) + "/3"); delay(2000); }
  }
  Serial.println("[Sensors][ERROR] DHT22 failed after 3 attempts");
  return { 0, 0, false };
}

MPU6050Reading readMPU6050() {
  if (!mpuReady) return { 0,0,0,0,0,0, false };
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);
  return {
    a.acceleration.x / 9.81f,
    a.acceleration.y / 9.81f,
    a.acceleration.z / 9.81f,
    g.gyro.x, g.gyro.y, g.gyro.z,
    true
  };
}

float computeVibrationMagnitude(float ax, float ay, float az) {
  // Total acceleration magnitude, then subtract 1G (static gravity) so a
  // stationary device reads 0 and the threshold measures *dynamic* vibration only.
  float total = sqrt(ax*ax + ay*ay + az*az);
  return fmaxf(0.0f, total - 1.0f);
}

SensorBundle readAll() {
  SensorBundle b;
  b.timestamp_ms        = millis();
  b.dht                 = readDHT22();
  b.mpu                 = readMPU6050();
  b.vibration_magnitude = b.mpu.valid ? computeVibrationMagnitude(b.mpu.accel_x, b.mpu.accel_y, b.mpu.accel_z) : 0.0f;
  return b;
}
