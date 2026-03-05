#!/usr/bin/env python3
"""
TruckNet ESP32 Serial Monitor
Adds timestamps and color to ESP32 debug output.

Usage:
  pip install pyserial
  python3 monitor.py --port /dev/ttyUSB0    # Linux
  python3 monitor.py --port /dev/tty.usbserial-*  # macOS
  python3 monitor.py --port COM3            # Windows
"""

import serial
import argparse
import datetime
import sys

RED    = '\033[91m'; YELLOW = '\033[93m'; GREEN  = '\033[92m'
CYAN   = '\033[96m'; BLUE   = '\033[94m'; DIM    = '\033[2m'; RESET  = '\033[0m'

COLOR_MAP = {
    '[READ]':    GREEN,
    '[WiFi]':    BLUE,
    '[MQTT]':    CYAN,
    '[NTP]':     CYAN,
    '[OTA]':     CYAN,
    '[WDT]':     DIM,
    '[Sensors]': GREEN,
    '[WARN]':    YELLOW,
    '[ERROR]':   RED,
    '[Alert]':   RED,
    '[TruckNet]':GREEN,
}

def colorize(line):
    for key, color in COLOR_MAP.items():
        if key in line:
            return color + line + RESET
    return line

def main():
    parser = argparse.ArgumentParser(description='ESP32 Serial Monitor with timestamps')
    parser.add_argument('--port',  required=True,       help='Serial port e.g. /dev/ttyUSB0 or COM3')
    parser.add_argument('--baud',  type=int, default=115200)
    args = parser.parse_args()

    try:
        ser = serial.Serial(args.port, args.baud, timeout=1)
        print(f"{GREEN}Monitoring {args.port} at {args.baud} baud. Ctrl+C to exit.{RESET}\n")
    except serial.SerialException as e:
        print(f"{RED}Cannot open {args.port}: {e}{RESET}"); sys.exit(1)

    try:
        while True:
            line = ser.readline().decode('utf-8', errors='replace').rstrip()
            if line:
                ts = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
                print(f"{DIM}[{ts}]{RESET} {colorize(line)}")
    except KeyboardInterrupt:
        print(f"\n{DIM}Monitor closed.{RESET}")
    finally:
        ser.close()

if __name__ == '__main__':
    main()
