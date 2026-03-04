DO $$ BEGIN
 CREATE TYPE "public"."call_status" AS ENUM('ongoing', 'completed', 'missed', 'declined');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_type" AS ENUM('voice', 'video');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_name" varchar(100) NOT NULL,
	"caller_id" uuid,
	"callee_id" uuid,
	"call_type" "call_type" NOT NULL,
	"status" "call_status" DEFAULT 'ongoing' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_history_room_name_unique" UNIQUE("room_name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_history" ADD CONSTRAINT "call_history_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_history" ADD CONSTRAINT "call_history_callee_id_users_id_fk" FOREIGN KEY ("callee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_history_caller_id_idx" ON "call_history" ("caller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_history_callee_id_idx" ON "call_history" ("callee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_history_created_at_idx" ON "call_history" ("created_at");