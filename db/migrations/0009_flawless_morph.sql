DO $$ BEGIN
 CREATE TYPE "public"."driving_event_severity" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."driving_event_type" AS ENUM('speed_violation', 'harsh_braking', 'harsh_acceleration', 'sudden_swerve', 'drowsiness_alert', 'microsleep_alert', 'distraction_alert', 'idle_excess', 'sos_triggered');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_source" AS ENUM('gps', 'esp32', 'ai_camera', 'driver');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "behaviour_reports" (
	"behaviour_report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"global_score" integer NOT NULL,
	"speed_score" integer NOT NULL,
	"driving_style_score" integer NOT NULL,
	"fatigue_score" integer NOT NULL,
	"idle_score" integer NOT NULL,
	"speed_violation_count" integer DEFAULT 0 NOT NULL,
	"max_speed_recorded_kmh" real,
	"max_speed_excess_kmh" real,
	"harsh_braking_count" integer DEFAULT 0 NOT NULL,
	"harsh_acceleration_count" integer DEFAULT 0 NOT NULL,
	"sudden_swerve_count" integer DEFAULT 0 NOT NULL,
	"drowsiness_alert_count" integer DEFAULT 0 NOT NULL,
	"microsleep_alert_count" integer DEFAULT 0 NOT NULL,
	"distraction_alert_count" integer DEFAULT 0 NOT NULL,
	"idle_excess_count" integer DEFAULT 0 NOT NULL,
	"total_idle_minutes" real DEFAULT 0 NOT NULL,
	"sos_count" integer DEFAULT 0 NOT NULL,
	"total_events" integer DEFAULT 0 NOT NULL,
	"critical_events" integer DEFAULT 0 NOT NULL,
	"trip_distance_km" real,
	"trip_duration_hours" real,
	"events_per_100km" real,
	"status" varchar(20) DEFAULT 'generating' NOT NULL,
	"admin_reviewed" boolean DEFAULT false NOT NULL,
	"admin_reviewed_by" uuid,
	"admin_reviewed_at" timestamp with time zone,
	"admin_note" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "behaviour_reports_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "behaviour_scoring_config" (
	"config_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"harsh_braking_threshold_g" real DEFAULT 0.4 NOT NULL,
	"harsh_acceleration_threshold_g" real DEFAULT 0.35 NOT NULL,
	"swerve_threshold_g" real DEFAULT 0.3 NOT NULL,
	"speed_violation_excess_kmh" real DEFAULT 10 NOT NULL,
	"idle_excess_minutes" real DEFAULT 10 NOT NULL,
	"ear_drowsy_threshold" real DEFAULT 0.25 NOT NULL,
	"ear_microsleep_threshold" real DEFAULT 0.2 NOT NULL,
	"drowsy_duration_seconds" real DEFAULT 2 NOT NULL,
	"microsleep_duration_seconds" real DEFAULT 3 NOT NULL,
	"head_angle_distraction_deg" real DEFAULT 30 NOT NULL,
	"distraction_duration_seconds" real DEFAULT 3 NOT NULL,
	"weight_speed" integer DEFAULT 25 NOT NULL,
	"weight_driving_style" integer DEFAULT 20 NOT NULL,
	"weight_fatigue" integer DEFAULT 30 NOT NULL,
	"weight_idle" integer DEFAULT 10 NOT NULL,
	"weight_sos" integer DEFAULT 15 NOT NULL,
	"deduction_speed_minor" integer DEFAULT 5 NOT NULL,
	"deduction_speed_major" integer DEFAULT 10 NOT NULL,
	"deduction_harsh_braking" integer DEFAULT 3 NOT NULL,
	"deduction_harsh_acceleration" integer DEFAULT 3 NOT NULL,
	"deduction_swerve" integer DEFAULT 5 NOT NULL,
	"deduction_drowsiness" integer DEFAULT 15 NOT NULL,
	"deduction_microsleep" integer DEFAULT 25 NOT NULL,
	"deduction_distraction" integer DEFAULT 8 NOT NULL,
	"deduction_idle_per_10min" integer DEFAULT 2 NOT NULL,
	"deduction_sos" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driving_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"event_type" "driving_event_type" NOT NULL,
	"severity" "driving_event_severity" DEFAULT 'low' NOT NULL,
	"source" "event_source" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"duration_seconds" real,
	"gps_lat" real,
	"gps_lng" real,
	"gps_speed_kmh" real,
	"speed_limit_kmh" real,
	"speed_excess_kmh" real,
	"vibration_magnitude" real,
	"accel_x" real,
	"accel_y" real,
	"accel_z" real,
	"ear_value" real,
	"head_angle_deg" real,
	"confidence" real,
	"idle_duration_minutes" real,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gps_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"speed_kmh" real,
	"heading_deg" real,
	"accuracy_m" real,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transport_trips" ADD COLUMN "behaviour_report_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "behaviour_reports" ADD CONSTRAINT "behaviour_reports_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "behaviour_reports" ADD CONSTRAINT "behaviour_reports_trip_id_transport_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."transport_trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "behaviour_reports" ADD CONSTRAINT "behaviour_reports_admin_reviewed_by_users_id_fk" FOREIGN KEY ("admin_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "behaviour_scoring_config" ADD CONSTRAINT "behaviour_scoring_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driving_events" ADD CONSTRAINT "driving_events_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driving_events" ADD CONSTRAINT "driving_events_trip_id_transport_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."transport_trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gps_tracks" ADD CONSTRAINT "gps_tracks_trip_id_transport_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."transport_trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gps_tracks" ADD CONSTRAINT "gps_tracks_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "behaviour_reports_driver_id_idx" ON "behaviour_reports" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "behaviour_reports_trip_id_idx" ON "behaviour_reports" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "behaviour_reports_global_score_idx" ON "behaviour_reports" ("global_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "behaviour_reports_generated_at_idx" ON "behaviour_reports" ("generated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driving_events_driver_id_idx" ON "driving_events" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driving_events_trip_id_idx" ON "driving_events" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driving_events_event_type_idx" ON "driving_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driving_events_occurred_at_idx" ON "driving_events" ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driving_events_source_idx" ON "driving_events" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gps_tracks_trip_time_idx" ON "gps_tracks" ("trip_id","recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gps_tracks_driver_time_idx" ON "gps_tracks" ("driver_id","recorded_at");