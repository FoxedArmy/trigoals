CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"strava_activity_id" text,
	"sport" text NOT NULL,
	"name" text,
	"start_time" timestamp NOT NULL,
	"duration_sec" integer NOT NULL,
	"distance_m" real,
	"avg_power" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"avg_pace_sec_per_km" integer,
	"elevation_m" real,
	"load" integer,
	"raw_file_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ftp" integer,
	"threshold_pace_run" integer,
	"css" integer,
	"lthr" integer,
	"max_hr" integer,
	"rest_hr" integer,
	"weight_kg" real,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"description" text,
	"focus" text,
	"weeks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"sport" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'endurance' NOT NULL,
	"planned_duration_sec" integer,
	"planned_distance_m" real,
	"target_zone" integer,
	"planned_load" integer,
	"structure" jsonb,
	"race_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"sport" text NOT NULL,
	"distance_label" text,
	"priority" text DEFAULT 'B' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"scope" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workout_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"planned_workout_id" text,
	"activity_id" text,
	"status" text NOT NULL,
	"compliance_score" integer,
	"auto_matched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_templates" ADD CONSTRAINT "plan_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_matches" ADD CONSTRAINT "workout_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_matches" ADD CONSTRAINT "workout_matches_planned_workout_id_planned_workouts_id_fk" FOREIGN KEY ("planned_workout_id") REFERENCES "public"."planned_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_matches" ADD CONSTRAINT "workout_matches_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_user_start_idx" ON "activities" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_strava_idx" ON "activities" USING btree ("user_id","strava_activity_id");--> statement-breakpoint
CREATE INDEX "planned_user_date_idx" ON "planned_workouts" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "match_planned_idx" ON "workout_matches" USING btree ("planned_workout_id");--> statement-breakpoint
CREATE INDEX "match_user_idx" ON "workout_matches" USING btree ("user_id");