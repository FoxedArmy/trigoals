ALTER TABLE "strava_connections" ADD COLUMN "athlete_name" text;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD COLUMN "last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;