DO $$ BEGIN
 CREATE TYPE "public"."device_status" AS ENUM('online', 'offline', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sensor_alert_status" AS ENUM('active', 'acknowledged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sensor_alert_type" AS ENUM('temp_high', 'temp_low', 'humidity_high', 'vibration_high');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iot_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"driver_id" uuid,
	"truck_label" varchar(100) NOT NULL,
	"status" "device_status" DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"firmware_version" varchar(20),
	"alert_config" json DEFAULT '{"temp_min_c":2,"temp_max_c":8,"humidity_max_pct":85,"vibration_max_g":0.5}'::json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iot_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensor_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"driver_id" uuid,
	"alert_type" "sensor_alert_type" NOT NULL,
	"value" real NOT NULL,
	"threshold" real NOT NULL,
	"status" "sensor_alert_status" DEFAULT 'active' NOT NULL,
	"triggered_at" timestamp with time zone NOT NULL,
	"acked_at" timestamp with time zone,
	"acked_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensor_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"temperature_c" real NOT NULL,
	"humidity_pct" real NOT NULL,
	"vibration_magnitude" real NOT NULL,
	"accel_x" real NOT NULL,
	"accel_y" real NOT NULL,
	"accel_z" real NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensor_alerts" ADD CONSTRAINT "sensor_alerts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensor_alerts" ADD CONSTRAINT "sensor_alerts_acked_by_users_id_fk" FOREIGN KEY ("acked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iot_devices_device_id_idx" ON "iot_devices" ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iot_devices_status_idx" ON "iot_devices" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensor_alerts_device_status_idx" ON "sensor_alerts" ("device_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensor_alerts_status_time_idx" ON "sensor_alerts" ("status","triggered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensor_readings_device_time_idx" ON "sensor_readings" ("device_id","recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensor_readings_time_idx" ON "sensor_readings" ("recorded_at");