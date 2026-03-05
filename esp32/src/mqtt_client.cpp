#include "mqtt_client.h"
#include "config.h"
#include "payload.h"
#include <ArduinoJson.h>

static WiFiClient*   _wc              = nullptr;
static PubSubClient* _client          = nullptr;
static unsigned long _lastReconnectAt = 0;
static unsigned long _backoff         = MQTT_RECONNECT_DELAY_MS;

static char _topicReadings[80];
static char _topicStatus[80];
static char _topicCommand[80];

unsigned long currentReadIntervalMs = READ_INTERVAL_MS;

static void onMessage(char* topic, byte* payload, unsigned int len) {
  String msg; for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];
  Serial.println("[MQTT] Command: " + msg);
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, msg)) return;
  const char* cmd = doc["cmd"];
  if (cmd && strcmp(cmd, "set_interval") == 0) {
    int s = constrain((int)doc["intervalSeconds"], 1, 60);
    currentReadIntervalMs = (unsigned long)s * 1000UL;
    Serial.println("[MQTT] Interval → " + String(s) + "s");
  }
}

static bool connectMqtt() {
  String cid = String("esp32-") + DEVICE_ID;
  String lwt = buildLwtPayload();
  Serial.print("[MQTT] Connecting as " + cid + "...");
  bool ok = _client->connect(cid.c_str(), MQTT_USERNAME, MQTT_PASSWORD,
                              _topicStatus, MQTT_QOS, true, lwt.c_str());
  if (!ok) { Serial.println(" failed rc=" + String(_client->state())); return false; }
  Serial.println(" OK");
  String online = buildStatusPayload("online");
  _client->publish(_topicStatus, online.c_str(), true);
  _client->subscribe(_topicCommand, MQTT_QOS);
  _backoff = MQTT_RECONNECT_DELAY_MS;
  return true;
}

void initMqtt(WiFiClient& wc) {
  _wc     = &wc;
  _client = new PubSubClient(wc);
  snprintf(_topicReadings, sizeof(_topicReadings), "trucknet/sensors/%s/readings", DEVICE_ID);
  snprintf(_topicStatus,   sizeof(_topicStatus),   "trucknet/sensors/%s/status",   DEVICE_ID);
  snprintf(_topicCommand,  sizeof(_topicCommand),  "trucknet/sensors/%s/command",  DEVICE_ID);
  _client->setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  _client->setCallback(onMessage);
  _client->setKeepAlive(MQTT_KEEPALIVE_SECONDS);
  _client->setBufferSize(MQTT_MAX_PACKET_SIZE);  // CRITICAL — default 256 truncates payload
}

bool ensureConnected() {
  if (_client->connected()) return true;
  unsigned long now = millis();
  if (now - _lastReconnectAt < _backoff) return false;
  _lastReconnectAt = now;
  bool ok = connectMqtt();
  if (!ok) _backoff = min(_backoff * 2, 30000UL);
  return ok;
}

bool publishReading(const String& p) {
  return _client->publish(_topicReadings, p.c_str(), false);
}
bool publishStatus(const String& p, bool retained) {
  return _client->publish(_topicStatus, p.c_str(), retained);
}
void mqttLoop()     { if (_client) _client->loop(); }
bool mqttConnected(){ return _client && _client->connected(); }
