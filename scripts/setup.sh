#!/usr/bin/env bash
# TruckNet — Automated Setup Script
# Run from the root of the project in Git Bash:
#   bash scripts/setup.sh
# Or for a per-device setup only:
#   bash scripts/setup.sh --device

set -euo pipefail

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}\n"; }

# ─── Helpers ────────────────────────────────────────────────────────────────
prompt() {
  local var="$1" msg="$2" default="${3:-}"
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "${YELLOW}?${NC} ${msg} [${default}]: ")" value
    value="${value:-$default}"
  else
    read -rp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" value
    while [[ -z "$value" ]]; do
      warn "This field is required."
      read -rp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" value
    done
  fi
  printf -v "$var" '%s' "$value"
}

prompt_password() {
  local var="$1" msg="$2"
  read -rsp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" value
  echo
  while [[ -z "$value" ]]; do
    warn "Password cannot be empty."
    read -rsp "$(echo -e "${YELLOW}?${NC} ${msg}: ")" value
    echo
  done
  printf -v "$var" '%s' "$value"
}

# URL-encode a string (percent-encode special chars)
urlencode() {
  local raw="$1" encoded=""
  for (( i=0; i<${#raw}; i++ )); do
    local c="${raw:$i:1}"
    case "$c" in
      [A-Za-z0-9._~-]) encoded+="$c" ;;
      *) encoded+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  echo "$encoded"
}

# Upsert a KEY=VALUE line in a file (adds if missing, replaces if present)
upsert_env() {
  local file="$1" key="$2" value="$3"
  # Escape for sed replacement
  local escaped_val
  escaped_val=$(printf '%s\n' "$value" | sed 's/[\/&]/\\&/g')
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${escaped_val}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# ─── Mode ───────────────────────────────────────────────────────────────────
DEVICE_ONLY=false
[[ "${1:-}" == "--device" ]] && DEVICE_ONLY=true

# ─── Check dependencies ─────────────────────────────────────────────────────
for cmd in docker docker-compose; do
  command -v "$cmd" &>/dev/null || error "'$cmd' not found — install Docker Desktop first."
done

# ════════════════════════════════════════════════════════════════════════════
#  PART A — SERVER-SIDE SETUP (skip with --device)
# ════════════════════════════════════════════════════════════════════════════

if ! $DEVICE_ONLY; then

header "Part A — Server-side Setup"

# ── Step 1: MQTT password ────────────────────────────────────────────────────
echo "Choose an MQTT broker password (min 8 chars, avoid ! and !!)."
echo "This will be set in Mosquitto and written to .env / .env.local."
echo
prompt_password MQTT_PASSWORD "MQTT password"
[[ ${#MQTT_PASSWORD} -lt 8 ]] && error "Password must be at least 8 characters."

# ── Step 2: Generate Mosquitto passwd file ───────────────────────────────────
info "Generating Mosquitto passwd file..."
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${PWD}/docker/mosquitto:/mosquitto/config" \
  eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/passwd trucknet "$MQTT_PASSWORD"
success "Mosquitto passwd file written to docker/mosquitto/passwd"

# ── Step 3: Write .env ───────────────────────────────────────────────────────
info "Updating .env..."
touch .env
upsert_env .env "MQTT_PASSWORD" "$MQTT_PASSWORD"
success ".env updated"

# ── Step 4: Write .env.local ─────────────────────────────────────────────────
info "Updating .env.local..."
touch .env.local
MQTT_PASS_ENCODED=$(urlencode "$MQTT_PASSWORD")
upsert_env .env.local "MQTT_PASSWORD" "$MQTT_PASSWORD"
upsert_env .env.local "MQTT_URL" "mqtt://trucknet:${MQTT_PASS_ENCODED}@localhost:1883"
success ".env.local updated"

# ── Step 5: Start services ───────────────────────────────────────────────────
info "Starting Mosquitto and sensor-worker..."
docker-compose up -d mosquitto sensor-worker
success "Services started"

echo
info "Run 'docker-compose ps' to verify all containers are healthy."

fi  # end Part A

# ════════════════════════════════════════════════════════════════════════════
#  PART B — PER-DEVICE SETUP
# ════════════════════════════════════════════════════════════════════════════

header "Part B — Per-device Setup"

echo "This will configure esp32/src/main/credentials.h and config.h,"
echo "then register the device in the database."
echo

# ── Collect device info ──────────────────────────────────────────────────────
prompt DEVICE_ID   "Device ID (e.g. truck-001, truck-042)" "truck-001"
prompt TRUCK_LABEL "Truck label (e.g. Volvo FH16 — AB-123-CD)"

# ── Collect WiFi info ────────────────────────────────────────────────────────
prompt WIFI_SSID     "WiFi SSID"
prompt_password WIFI_PASSWORD "WiFi password"

# ── Collect MQTT password (re-use Part A value or ask again) ─────────────────
if [[ -z "${MQTT_PASSWORD:-}" ]]; then
  if grep -q "^MQTT_PASSWORD=" .env 2>/dev/null; then
    MQTT_PASSWORD=$(grep "^MQTT_PASSWORD=" .env | cut -d= -f2-)
    info "Using MQTT_PASSWORD from .env"
  else
    prompt_password MQTT_PASSWORD "MQTT password (must match broker)"
  fi
fi

# ── Collect OTA password ─────────────────────────────────────────────────────
prompt_password OTA_PASSWORD "OTA password (used for WiFi firmware updates)"

# ── Detect PC IP automatically ───────────────────────────────────────────────
DETECTED_IP=""
if command -v ipconfig &>/dev/null; then
  # Windows ipconfig — grab first wireless IPv4
  DETECTED_IP=$(ipconfig 2>/dev/null | grep -A4 -i "Wireless\|Wi-Fi" \
    | grep -i "IPv4" | head -1 \
    | grep -oP '\d+\.\d+\.\d+\.\d+' | head -1 || true)
else
  # Linux/macOS fallback
  DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
fi

prompt BROKER_IP "MQTT broker IP (your PC's WiFi IPv4)" "${DETECTED_IP:-192.168.1.100}"

# ── Write credentials.h ──────────────────────────────────────────────────────
CREDS_DEST="esp32/src/main/credentials.h"
info "Writing ${CREDS_DEST}..."
cat > "$CREDS_DEST" <<CREDS_EOF
#pragma once

// WiFi network the truck connects to (hotspot or depot WiFi)
#define WIFI_SSID         "${WIFI_SSID}"
#define WIFI_PASSWORD     "${WIFI_PASSWORD}"

// MQTT broker credentials — must match Mosquitto passwd file
#define MQTT_USERNAME     "trucknet"
#define MQTT_PASSWORD     "${MQTT_PASSWORD}"

// OTA password — used to push firmware updates over WiFi after first flash
#define OTA_PASSWORD      "${OTA_PASSWORD}"
CREDS_EOF
success "credentials.h written"

# ── Patch config.h ───────────────────────────────────────────────────────────
CONFIG_H="esp32/src/main/config.h"
info "Patching ${CONFIG_H}..."
sed -i "s|#define DEVICE_ID\s*\"[^\"]*\"|#define DEVICE_ID           \"${DEVICE_ID}\"|" "$CONFIG_H"
sed -i "s|#define MQTT_BROKER_HOST\s*\"[^\"]*\"|#define MQTT_BROKER_HOST        \"${BROKER_IP}\"|" "$CONFIG_H"
success "config.h patched (DEVICE_ID=${DEVICE_ID}, MQTT_BROKER_HOST=${BROKER_IP})"

# ── Register device in DB ────────────────────────────────────────────────────
info "Registering ${DEVICE_ID} in database..."
if docker-compose ps | grep -q "postgres.*healthy\|postgres.*Up"; then
  docker-compose exec -T postgres psql -U trucknet -d trucknet \
    -c "INSERT INTO iot_devices (device_id, truck_label, status)
        VALUES ('${DEVICE_ID}', '${TRUCK_LABEL}', 'unknown')
        ON CONFLICT (device_id)
        DO UPDATE SET truck_label = EXCLUDED.truck_label;" 2>/dev/null \
    && success "Device '${DEVICE_ID}' registered in DB (label: ${TRUCK_LABEL})" \
    || warn "DB insert failed — you can register manually at /admin/sensors"
else
  warn "Postgres container not running — skipping DB registration."
  warn "Start it with 'docker-compose up -d postgres' then re-run with --device."
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${GREEN}════ Setup complete ════${NC}"
echo
echo -e "  Device ID  : ${BOLD}${DEVICE_ID}${NC}"
echo -e "  Truck label: ${BOLD}${TRUCK_LABEL}${NC}"
echo -e "  Broker IP  : ${BOLD}${BROKER_IP}:1883${NC}"
echo -e "  WiFi SSID  : ${BOLD}${WIFI_SSID}${NC}"
echo
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Open Arduino IDE → File → Open → esp32/src/main/main.ino"
echo "  2. Tools → Board → DOIT ESP32 DEVKIT V1"
echo "  3. Tools → Port → select your COM port"
echo "  4. Sketch → Upload  (Ctrl+U)"
echo "  5. Tools → Serial Monitor at 115200 baud — verify connection"
echo
echo "  Admin panel: http://localhost:3000/admin/sensors"
echo
