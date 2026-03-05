#!/usr/bin/env python3
"""
TruckNet MQTT Test Subscriber
Verifies that ESP32 is publishing sensor readings correctly.

Usage:
  pip install paho-mqtt
  python3 test_mqtt.py --host 192.168.1.100 --password your_mqtt_password
  python3 test_mqtt.py --host 192.168.1.100 --password your_mqtt_password --device truck-001
"""

import paho.mqtt.client as mqtt
import json
import argparse
import datetime
import sys

# ANSI color codes
GREEN  = '\033[92m'
YELLOW = '\033[93m'
RED    = '\033[91m'
CYAN   = '\033[96m'
DIM    = '\033[2m'
RESET  = '\033[0m'

# Default thresholds (matches DEFAULT_ALERT_CONFIG)
THRESHOLDS = {
    'temp_min': 2.0, 'temp_max': 8.0,
    'humidity_max': 85.0, 'vibration_max': 0.5,
}


def color_value(val, lo=None, hi=None):
    """Return colored string: green=ok, yellow=near, red=breached."""
    if hi is not None and val > hi:   return RED + str(val) + RESET
    if lo is not None and val < lo:   return RED + str(val) + RESET
    return GREEN + str(val) + RESET


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        topic = f"trucknet/sensors/{userdata['device']}/#"
        print(f"{CYAN}[Connected]{RESET} Subscribed to {topic}\n")
        client.subscribe(topic, qos=1)
    else:
        print(f"{RED}[Error]{RESET} Connection failed rc={rc}")
        sys.exit(1)


def on_message(client, userdata, msg):
    ts   = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
    kind = msg.topic.split('/')[-1]  # readings / status / command

    try:
        data = json.loads(msg.payload.decode())
    except Exception:
        print(f"{DIM}[{ts}]{RESET} {msg.topic}: {msg.payload}")
        return

    if kind == 'readings':
        t = data.get('temperature_c', 0)
        h = data.get('humidity_pct', 0)
        v = data.get('vibration_magnitude', 0)
        t_str = color_value(round(t, 1), THRESHOLDS['temp_min'], THRESHOLDS['temp_max'])
        h_str = color_value(round(h, 1), hi=THRESHOLDS['humidity_max'])
        v_str = color_value(round(v, 3), hi=THRESHOLDS['vibration_max'])
        fw    = data.get('firmware_version', '?')
        print(f"{DIM}[{ts}]{RESET} {CYAN}{data.get('deviceId')}{RESET}  "
              f"🌡 {t_str}°C  💧 {h_str}%  📳 {v_str}G  {DIM}fw:{fw}{RESET}")

    elif kind == 'status':
        status = data.get('status', '?')
        color  = GREEN if status == 'online' else RED
        print(f"{DIM}[{ts}]{RESET} {CYAN}{data.get('deviceId')}{RESET}  "
              f"Status: {color}{status.upper()}{RESET}")

    else:
        print(f"{DIM}[{ts}] {msg.topic}:{RESET} {json.dumps(data)}")


def main():
    parser = argparse.ArgumentParser(description='TruckNet MQTT Test Subscriber')
    parser.add_argument('--host',     required=True,            help='MQTT broker host/IP')
    parser.add_argument('--port',     type=int, default=1883,   help='MQTT broker port (default 1883)')
    parser.add_argument('--username', default='trucknet',       help='MQTT username (default: trucknet)')
    parser.add_argument('--password', required=True,            help='MQTT password (from .env MQTT_PASSWORD)')
    parser.add_argument('--device',   default='#',              help='Device ID filter (default: # = all)')
    args = parser.parse_args()

    client = mqtt.Client(userdata={'device': args.device})
    client.username_pw_set(args.username, args.password)
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"Connecting to {args.host}:{args.port} as {args.username}...")
    client.connect(args.host, args.port, keepalive=60)
    client.loop_forever()


if __name__ == '__main__':
    main()
