DO $$ BEGIN
 CREATE TYPE "public"."route_status" AS ENUM('active', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"origin_lat" double precision NOT NULL,
	"origin_lng" double precision NOT NULL,
	"destination_lat" double precision NOT NULL,
	"destination_lng" double precision NOT NULL,
	"destination_label" text NOT NULL,
	"route_geometry" json NOT NULL,
	"distance_meters" double precision NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"status" "route_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_routes" ADD CONSTRAINT "driver_routes_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_routes_driver_id_status_idx" ON "driver_routes" ("driver_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_routes_status_created_at_idx" ON "driver_routes" ("status","created_at");