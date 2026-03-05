#pragma once

// ─────────────────────────────────────────────────────────────────────────────
//  TruckNet ESP32 — Sensor Interface
//  DHT22  → temperature + humidity (GPIO4)
//  MPU6050 → 3-axis accelerometer, vibration magnitude (I2C)
// ─────────────────────────────────────────────────────────────────────────────

struct DHT22Reading {
  float temperature_c;
  float humidity_pct;
  bool  valid;
};

struct MPU6050Reading {
  float accel_x;  // G-force
  float accel_y;
  float accel_z;
  float gyro_x;   // rad/s
  float gyro_y;
  float gyro_z;
  bool  valid;
};

struct SensorBundle {
  DHT22Reading   dht;
  MPU6050Reading mpu;
  float          vibration_magnitude;  // sqrt(ax²+ay²+az²) in G
  unsigned long  timestamp_ms;         // millis() at read time
};

bool         initSensors();   // returns false if MPU6050 not found on I2C
DHT22Reading readDHT22();     // up to 3 retries, 2s apart
MPU6050Reading readMPU6050(); // returns { valid: false } on I2C error
float        computeVibrationMagnitude(float ax, float ay, float az);
SensorBundle readAll();       // combines both sensors into one bundle
