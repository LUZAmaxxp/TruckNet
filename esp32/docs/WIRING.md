# TruckNet ESP32 — Wiring Guide

> ⚠️ ESP32 GPIO pins operate at **3.3V**. Connect both sensors to **3.3V**, NOT 5V.

## Bill of Materials

| Component | Qty | ~Cost |
|-----------|-----|-------|
| ESP32 DevKit V1 (30 or 38 pin) | 1 | $7 |
| DHT22 (AM2302) sensor | 1 | $4 |
| MPU6050 GY-521 module | 1 | $2 |
| 10kΩ resistor | 1 | $0.10 |
| Breadboard + jumper wires | 1 set | $3 |
| **Total** | | **~$16** |

## DHT22 Connections

| DHT22 Pin | ESP32 Pin | Notes |
|-----------|-----------|-------|
| Pin 1 VCC | 3.3V | NOT 5V |
| Pin 2 DATA | GPIO4 | Add 10kΩ pull-up between VCC and DATA |
| Pin 3 NC | — | Leave unconnected |
| Pin 4 GND | GND | |

## MPU6050 Connections

| MPU6050 Pin | ESP32 Pin | Notes |
|-------------|-----------|-------|
| VCC | 3.3V | NOT 5V |
| GND | GND | |
| SDA | GPIO21 | I2C data |
| SCL | GPIO22 | I2C clock |
| AD0 | GND | Sets I2C address to 0x68 |
| INT | — | Not used |

## Circuit Diagram

```
              ESP32 DevKit V1
         ┌──────────────────────┐
 3.3V ───┤ 3V3            GND   ├─── GND (common ground)
         │                      │
GPIO4 ───┤ D4             D21   ├─── SDA ──► MPU6050
         │                      │
         │                D22   ├─── SCL ──► MPU6050
         └──────────────────────┘

DHT22                          MPU6050 (GY-521)
┌─────────┐                    ┌──────────────┐
│ 1: VCC  ├──── 3.3V           │ VCC  ├── 3.3V│
│ 2: DATA ├──── GPIO4          │ GND  ├── GND │
│         │     │              │ SDA  ├── D21 │
│         │    10kΩ            │ SCL  ├── D22 │
│         │     │              │ AD0  ├── GND │
│         └─ 3.3V              └──────────────┘
│ 3: NC   │
│ 4: GND  ├──── GND
└─────────┘
```

## Installation Notes

- Mount the MPU6050 **flat and level** inside the container for accurate vibration baseline
- Run the DHT22 cable away from heat sources inside the container
- In production: use a small weatherproof enclosure (IP65 or better) for the ESP32 + breadboard
- Power options: USB power bank, or tap the truck's 12V/24V supply via a 5V buck converter
