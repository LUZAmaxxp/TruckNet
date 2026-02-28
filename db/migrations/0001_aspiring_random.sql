DO $$ BEGIN
 CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_requests_sender_receiver_unique" UNIQUE("sender_id","receiver_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tag" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tag_number" integer;--> statement-breakpoint
-- Step 1: assign random tag_number to existing users
UPDATE "users" SET "tag_number" = floor(1000 + random() * 9000)::integer WHERE "tag_number" IS NULL;--> statement-breakpoint
-- Step 2: build tag from slugified name + tag_number
UPDATE "users"
SET "tag" = LOWER(REGEXP_REPLACE(SUBSTRING(name, 1, 12), '[^a-z0-9]', '', 'gi')) || '#' || LPAD("tag_number"::text, 4, '0')
WHERE "tag" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tag" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tag_number" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tag_unique" UNIQUE("tag");