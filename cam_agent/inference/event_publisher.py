import json
import time
import logging
import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)


class EventPublisher:
    def __init__(self, config: dict):
        self.config    = config
        self.driver_id = config["driver_id"]
        self._connected = False
        self.client    = mqtt.Client(client_id=f"cam-agent-{self.driver_id}")
        self.client.username_pw_set(
            config["mqtt_username"],
            config["mqtt_password"]
        )
        self.client.on_connect    = self._on_connect
        self.client.on_disconnect = self._on_disconnect

    def connect(self):
        self.client.connect(
            self.config["mqtt_broker_host"],
            self.config["mqtt_broker_port"],
            keepalive=60,
        )
        self.client.loop_start()

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def publish_event(
        self,
        trip_id:    str,
        event_type: str,
        severity:   str,
        confidence: float = 1.0,
        **kwargs,
    ):
        if not self._connected:
            logger.warning(f"[MQTT] Not connected — dropping {event_type}")
            return

        payload = {
            "driver_id":   self.driver_id,
            "trip_id":     trip_id,
            "event_type":  event_type,
            "severity":    severity,
            "source":      "ai_camera",
            "occurred_at": int(time.time() * 1000),
            "confidence":  round(confidence, 3),
            **kwargs,
        }
        topic = f"trucknet/drivers/{self.driver_id}/behaviour"
        self.client.publish(topic, json.dumps(payload), qos=1)
        logger.info(f"[Event] {event_type} sev={severity} conf={confidence:.2f}")

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            logger.info("[MQTT] Connected to broker")
        else:
            logger.error(f"[MQTT] Connection failed rc={rc}")

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        logger.warning("[MQTT] Disconnected")
