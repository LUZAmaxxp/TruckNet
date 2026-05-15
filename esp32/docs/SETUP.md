# TruckNet ESP32 — Setup Guide

---

## Automated Setup (recommended)

A single script handles Part A and Part B automatically:

```bash
# Full setup (server + one device)
bash scripts/setup.sh

# Per-device only (server already configured)
bash scripts/setup.sh --device
```

Run from the **project root** in **Git Bash**. It will prompt for passwords and
WiFi credentials, patch the ESP32 config files, and register the device in the DB.

After the script finishes, skip straight to **Step 8** (Arduino IDE) below.

---

## Manual Setup

Follow these steps if you prefer to configure things by hand.

---

## Part A — Server-side setup (do this once)

### Step 1 — Generate the Mosquitto passwd file

Run this command from the root of the TruckNet project (Git Bash on Windows).
The `MSYS_NO_PATHCONV=1` prefix is required on Windows to stop Git Bash mangling
the container path.

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${PWD}/docker/mosquitto:/mosquitto/config" \
  eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/passwd trucknet 'YOUR_MQTT_PASSWORD'
```

Replace `YOUR_MQTT_PASSWORD` with a password of your choice (min 8 chars, avoid `!`
and `!!` — they trigger bash history expansion and will cause a syntax error).

> **Why not `> /dev/stdout`?** That redirect causes a "symbolic link loop" error
> inside Docker on Windows. The volume-mount approach above writes directly to the
> local `docker/mosquitto/passwd` file instead.

### Step 2 — Add MQTT vars to `.env` and `.env.local`

Docker Compose reads `.env` (not `.env.local`) for `${VARIABLE}` substitution.
Add to **both** files:

**.env** (used by docker-compose):
```
MQTT_PASSWORD=YOUR_MQTT_PASSWORD
```

**.env.local** (used by Next.js and the sensor worker locally):
```
MQTT_URL=mqtt://trucknet:YOUR_MQTT_PASSWORD_URL_ENCODED@localhost:1883
MQTT_PASSWORD=YOUR_MQTT_PASSWORD
```

> **URL encoding:** `@` in the password must be written as `%40` in `MQTT_URL`
> because `@` is the URL separator between credentials and host.
> Example: password `TruckMQTT2024@@` → `MQTT_URL=mqtt://trucknet:TruckMQTT2024%40%40@localhost:1883`

### Step 3 — Start Mosquitto and the sensor worker

```bash
docker-compose up -d mosquitto sensor-worker
```

Verify both are running:
```bash
docker-compose ps
```

---

## Part B — Per-device setup (repeat for each ESP32 unit)

### Step 4 — Register the device in the admin panel

Start the Next.js app (`npm run dev`) and go to **`/admin/sensors`**.
Click **"Register Device"** in the top-right corner and fill in:

| Field | Example | Notes |
|-------|---------|-------|
| Device ID | `truck-001` | Lowercase, numbers, hyphens only. Must match `DEVICE_ID` in `config.h` |
| Truck Label | `Volvo FH16 — AB-123-CD` | Human-readable name shown in the dashboard |

> **Do this before flashing.** The sensor worker rejects readings from unregistered device IDs.

### Step 5 — Find your server's local IP

Run in Windows cmd or PowerShell:
```
ipconfig
```
Look for **Wireless LAN adapter Wi-Fi → IPv4 Address**, e.g. `192.168.1.100`.
The ESP32 connects to this IP to reach the Mosquitto broker.

### Step 6 — Create the credentials file

The file `esp32/config/credentials.h` is gitignored and must be created manually.
It already exists in your project — open it in VS Code and fill in your real values:

```cpp
#define WIFI_SSID      "YourWiFiName"
#define WIFI_PASSWORD  "YourWiFiPassword"
#define MQTT_USERNAME  "trucknet"
#define MQTT_PASSWORD  "YOUR_MQTT_PASSWORD"   // plain text, not URL-encoded
#define OTA_PASSWORD   "any-ota-password"
```

### Step 7 — Set device ID and broker IP

Open `esp32/src/config.h` in VS Code and update these two lines:

```cpp
#define DEVICE_ID        "truck-001"      // must match what you registered in Step 4
#define MQTT_BROKER_HOST "192.168.1.100"  // your PC's IP from Step 5
```

Both files (`credentials.h` and `config.h`) live in your TruckNet project folder —
edit them in VS Code, not in Arduino IDE.

### Step 8 — Install Arduino IDE and board support

1. Download Arduino IDE 2.x from https://www.arduino.cc/en/software
2. **File → Preferences** → paste into "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager** → search `esp32 by Espressif Systems` → Install **2.0.14**

### Step 9 — Install the 4 required libraries

**Sketch → Include Library → Manage Libraries**, install each:

| Library | Version | Notes |
|---------|---------|-------|
| PubSubClient | 2.8.0 | MQTT client |
| DHT sensor library (Adafruit) | 1.4.6 | Accept "Adafruit Unified Sensor" dependency |
| Adafruit MPU6050 | 2.2.6 | Accept all dependency installs |
| ArduinoJson | **6.21.5** | ⚠️ Must be v6.x — do NOT install v7.x |

### Step 10 — Flash

1. Connect the ESP32 to your PC via USB
2. In Arduino IDE: **Tools → Board → DOIT ESP32 DEVKIT V1**
3. **Tools → Port** → select your COM port (e.g. `COM4`)
4. **File → Open** → navigate to `TruckNet/esp32/src/main.ino`
   Arduino automatically loads all `.h`/`.cpp` files in the same `src/` folder
5. **Sketch → Upload** (`Ctrl+U`)

### Step 11 — Verify

Open **Tools → Serial Monitor** at **115200 baud**. You should see:
```
[WiFi] Connected: 192.168.x.x
[NTP] Syncing... OK
[MQTT] Connecting as esp32-truck-001... OK
[READ] T:22.4C  H:55.1%  V:0.031G
```

The device will appear as **online** in the TruckNet admin panel at `/admin/sensors`
within a few seconds.

---

## OTA Updates (after first USB flash)

Subsequent firmware updates can be pushed over WiFi — no USB cable needed:

1. Arduino IDE → **Tools → Port** → select **Network ports** → `truck-001.local`
2. **Sketch → Upload** — prompts for `OTA_PASSWORD` from `credentials.h`
