DO $$ BEGIN
 CREATE TYPE "public"."contract_type" AS ENUM('cdi', 'cdd', 'interim', 'apprenticeship', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."fuel_type" AS ENUM('diesel', 'petrol', 'lpg', 'electric', 'hydrogen', 'cng', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'non_binary', 'prefer_not_to_say');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."maintenance_type" AS ENUM('oil_change', 'tire_replacement', 'brake_service', 'technical_inspection', 'filter_replacement', 'battery', 'bodywork', 'fuel_fill', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."report_period" AS ENUM('weekly', 'monthly', 'quarterly', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."shift_status" AS ENUM('active', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."training_type" AS ENUM('license_renewal', 'adr_certification', 'eco_driving', 'defensive_driving', 'first_aid', 'cargo_handling', 'digital_tools', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_esg_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"period_type" "report_period" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_trips" integer DEFAULT 0 NOT NULL,
	"empty_run_count" integer DEFAULT 0 NOT NULL,
	"empty_run_pct" real,
	"total_distance_km" real DEFAULT 0 NOT NULL,
	"total_driving_hours" real DEFAULT 0 NOT NULL,
	"total_shift_hours" real DEFAULT 0 NOT NULL,
	"total_overtime_hours" real DEFAULT 0 NOT NULL,
	"total_fuel_liters" real DEFAULT 0 NOT NULL,
	"total_ghg_kgco2eq" real DEFAULT 0 NOT NULL,
	"ghg_intensity_per_km" real,
	"ghg_intensity_per_tonne_km" real,
	"incident_count" integer DEFAULT 0 NOT NULL,
	"work_stoppage_count" integer DEFAULT 0 NOT NULL,
	"cargo_breach_count" integer DEFAULT 0 NOT NULL,
	"avg_cargo_temp_c" real,
	"maintenance_count" integer DEFAULT 0 NOT NULL,
	"training_hours" real DEFAULT 0 NOT NULL,
	"certifications_count" integer DEFAULT 0 NOT NULL,
	"expiring_certifications_count" integer DEFAULT 0 NOT NULL,
	"trip_ids" json DEFAULT '[]'::json NOT NULL,
	"shift_ids" json DEFAULT '[]'::json NOT NULL,
	"incident_ids" json DEFAULT '[]'::json NOT NULL,
	"maintenance_ids" json DEFAULT '[]'::json NOT NULL,
	"training_ids" json DEFAULT '[]'::json NOT NULL,
	"sensor_reading_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'generating' NOT NULL,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"generated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"gender" "gender",
	"birth_year" integer,
	"nationality" varchar(100),
	"contract_type" "contract_type",
	"contract_start_date" date,
	"contract_end_date" date,
	"weekly_hours_contractual" real,
	"driving_license_categories" json DEFAULT '[]'::json NOT NULL,
	"license_obtained_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "driver_profiles_driver_id_unique" UNIQUE("driver_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"trip_id" uuid,
	"shift_date" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"driving_minutes" integer,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"night_shift" boolean DEFAULT false NOT NULL,
	"status" "shift_status" DEFAULT 'active' NOT NULL,
	"driver_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"training_type" "training_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"provider" varchar(200),
	"completed_at" date NOT NULL,
	"duration_hours" real NOT NULL,
	"cost_eur" real,
	"certification_number" varchar(100),
	"expiry_date" date,
	"passed" boolean DEFAULT true NOT NULL,
	"notes" text,
	"document_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "esg_report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_type" "report_period" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hr_email" varchar(300) NOT NULL,
	"language" varchar(10) DEFAULT 'fr' NOT NULL,
	"next_run_at" date NOT NULL,
	"last_run_at" date,
	"last_run_report_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transport_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"route_id" uuid,
	"vehicle_plate" varchar(20) NOT NULL,
	"origin_label" text,
	"destination_label" text,
	"distance_km" real,
	"duration_minutes" real,
	"fuel_liters" real,
	"fuel_type" "fuel_type",
	"cargo_weight_kg" real,
	"is_empty_run" boolean DEFAULT false NOT NULL,
	"load_factor_pct" real,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" "route_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_maintenance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid,
	"vehicle_plate" varchar(20) NOT NULL,
	"maintenance_type" "maintenance_type" NOT NULL,
	"performed_at" date NOT NULL,
	"odometer_km" real,
	"cost_eur" real,
	"fuel_liters" real,
	"fuel_type" "fuel_type",
	"provider_name" varchar(200),
	"next_due_at" date,
	"next_due_km" real,
	"regulatory_compliant" boolean DEFAULT true NOT NULL,
	"notes" text,
	"document_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_esg_reports" ADD CONSTRAINT "driver_esg_reports_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_esg_reports" ADD CONSTRAINT "driver_esg_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_trip_id_transport_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."transport_trips"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_training_records" ADD CONSTRAINT "driver_training_records_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_training_records" ADD CONSTRAINT "driver_training_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "esg_report_schedules" ADD CONSTRAINT "esg_report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_route_id_driver_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."driver_routes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_trips" ADD CONSTRAINT "transport_trips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_maintenance_logs" ADD CONSTRAINT "vehicle_maintenance_logs_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_maintenance_logs" ADD CONSTRAINT "vehicle_maintenance_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_esg_reports_driver_id_idx" ON "driver_esg_reports" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_esg_reports_period_idx" ON "driver_esg_reports" ("period_start","period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_esg_reports_status_idx" ON "driver_esg_reports" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_profiles_driver_id_idx" ON "driver_profiles" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_shifts_driver_id_idx" ON "driver_shifts" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_shifts_shift_date_idx" ON "driver_shifts" ("shift_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_shifts_driver_date_idx" ON "driver_shifts" ("driver_id","shift_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_training_driver_id_idx" ON "driver_training_records" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_training_completed_at_idx" ON "driver_training_records" ("completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_training_type_idx" ON "driver_training_records" ("training_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_training_expiry_date_idx" ON "driver_training_records" ("expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_trips_driver_id_idx" ON "transport_trips" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_trips_status_idx" ON "transport_trips" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_trips_started_at_idx" ON "transport_trips" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_trips_driver_status_idx" ON "transport_trips" ("driver_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_maintenance_driver_id_idx" ON "vehicle_maintenance_logs" ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_maintenance_plate_idx" ON "vehicle_maintenance_logs" ("vehicle_plate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_maintenance_performed_at_idx" ON "vehicle_maintenance_logs" ("performed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_maintenance_type_idx" ON "vehicle_maintenance_logs" ("maintenance_type");