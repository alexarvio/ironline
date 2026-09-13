CREATE TABLE "assignment_custom_values" (
	"id" integer PRIMARY KEY NOT NULL,
	"workout_assignment_id" integer,
	"column_id" integer,
	"value" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "calorie_logs" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"date" text,
	"kcal" double precision,
	"logged_at" text,
	"note" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "cardio_entries" (
	"id" integer PRIMARY KEY NOT NULL,
	"program_day_id" integer,
	"name" text,
	"time" text,
	"pace" text,
	"incline" text,
	"distance" text,
	"notes" text,
	"order_index" double precision,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "cardio_logs" (
	"id" integer PRIMARY KEY NOT NULL,
	"cardio_entry_id" integer,
	"client_id" integer,
	"done_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"sender" text,
	"text" text,
	"media_path" text,
	"media_type" text,
	"created_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "check_in_notes" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"kind" text,
	"period" text,
	"text" text,
	"created_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_exercise_notes" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"exercise_id" integer,
	"text" text,
	"updated_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_goals" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"term" text,
	"text" text,
	"done" boolean,
	"order_index" double precision,
	"created_at" text,
	"tracked_by" jsonb,
	"meeting_id" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_phases" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"track" text,
	"name" text,
	"start_week" text,
	"end_week" text,
	"nutrition" jsonb,
	"program_id" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_preferences" (
	"client_id" integer PRIMARY KEY NOT NULL,
	"coach_notes" boolean,
	"checkin_reminders" boolean,
	"weekly_digest" boolean,
	"units" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"client_id" integer PRIMARY KEY NOT NULL,
	"birthdate" text,
	"gender" text,
	"email" text,
	"phone" text,
	"address" text,
	"height_cm" double precision,
	"starting_weight_kg" double precision,
	"coaching_start_date" text,
	"current_week" text,
	"goal_phase" text,
	"goal_phase_start_date" text,
	"goal_date" text,
	"main_goal" text,
	"main_goal_saved_at" text,
	"check_in_day" text,
	"steps_goal" text,
	"cardio_goal" text,
	"training_goal" text,
	"water_goal" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_program_notes" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"program_id" integer,
	"text" text,
	"updated_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_reports" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"template_id" integer,
	"template_name" text,
	"period_start" text,
	"period_end" text,
	"status" text,
	"summary" text,
	"ai_generated" boolean,
	"sections_snapshot" text,
	"generated_at" text,
	"approved_at" text,
	"sent_at" text,
	"opened_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"avatar_path" text,
	"coach_id" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "coach_activity" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"message" text,
	"created_at" text,
	"kind" text,
	"read" boolean,
	"action_tab" text,
	"action_label" text,
	"action_ref" integer,
	"dedupe_key" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"muscle_tags" text,
	"video_url" text,
	"coach_id" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"description" text,
	"amount" double precision,
	"status" text,
	"created_at" text,
	"updated_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb
);
--> statement-breakpoint
CREATE TABLE "measurement_fields" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text,
	"unit" text,
	"order_index" double precision,
	"visible_to_client" boolean,
	"pinned" boolean,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "measurement_values" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"field_id" integer,
	"date" text,
	"value" double precision,
	"logged_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" integer PRIMARY KEY NOT NULL,
	"meeting_id" integer,
	"text" text,
	"created_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"coach_id" integer,
	"date" text,
	"time" text,
	"duration_minutes" double precision,
	"topic" text,
	"status" text,
	"link" text,
	"prep_notes" text,
	"summary" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"category" text,
	"name" text,
	"unit" text,
	"frequency" text,
	"order_index" double precision,
	"pinned" boolean,
	"visible_to_client" boolean,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "metric_entries" (
	"id" integer PRIMARY KEY NOT NULL,
	"metric_definition_id" integer,
	"period" text,
	"value" double precision,
	"logged_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "metric_template_categories" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"frequency" text,
	"order_index" double precision,
	"coach_id" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "metric_template_items" (
	"id" integer PRIMARY KEY NOT NULL,
	"template_category_id" integer,
	"name" text,
	"unit" text,
	"order_index" double precision,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "nutrition_plans" (
	"client_id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"maintenance_kcal" double precision,
	"ebf" double precision,
	"training_day_meals" jsonb,
	"rest_day_meals" jsonb,
	"vitamins" jsonb,
	"other" jsonb,
	"supplements" jsonb,
	"coach_notes" text,
	"day_targets" jsonb,
	"water_l" double precision,
	"supplement_rows" jsonb,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "photo_period_notes" (
	"client_id" integer NOT NULL,
	"period" text NOT NULL,
	"shape" text,
	"strengths" text,
	"improvements" text,
	"next_steps" text,
	"saved_at" text,
	"extra" jsonb,
	CONSTRAINT "photo_period_notes_client_id_period_pk" PRIMARY KEY("client_id","period")
);
--> statement-breakpoint
CREATE TABLE "photo_settings" (
	"client_id" integer PRIMARY KEY NOT NULL,
	"cadence" text,
	"photo_start_date" text,
	"photo_instructions" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "photo_slots" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"label" text,
	"order_index" double precision,
	"paused" boolean,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "photo_uploads" (
	"id" integer PRIMARY KEY NOT NULL,
	"slot_id" integer,
	"period" text,
	"file_path" text,
	"uploaded_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "program_days" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"week_number" double precision,
	"day_of_week" double precision,
	"label" text,
	"status" text,
	"is_rest" boolean,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "report_template_sections" (
	"id" integer PRIMARY KEY NOT NULL,
	"template_id" integer,
	"type" text,
	"label" text,
	"metric_name" text,
	"order_index" double precision,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"created_at" text,
	"coach_id" integer,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" integer PRIMARY KEY NOT NULL,
	"workout_assignment_id" integer,
	"set_number" double precision,
	"weight_kg" double precision,
	"reps" double precision,
	"rpe_actual" double precision,
	"logged_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "skinfold_entries" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"date" text,
	"site" text,
	"reading_mm" double precision,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "training_columns" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"key" text,
	"label" text,
	"kind" text,
	"visible" boolean,
	"order_index" double precision,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text,
	"start_week" double precision,
	"total_weeks" double precision,
	"status" text,
	"deployed_at" text,
	"scheduled_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY NOT NULL,
	"email" text,
	"password_hash" text,
	"role" text,
	"client_id" integer,
	"must_change_password" boolean,
	"created_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "workout_assignments" (
	"id" integer PRIMARY KEY NOT NULL,
	"program_day_id" integer,
	"exercise_id" integer,
	"order_index" double precision,
	"sets" double precision,
	"reps" text,
	"target_weight_kg" double precision,
	"rpe_target" double precision,
	"rest_seconds" double precision,
	"tempo" text,
	"distance" text,
	"time" text,
	"notes" text,
	"demo_url" text,
	"note_kind" text,
	"note_at" text,
	"note_read" boolean,
	"target_set_at" text,
	"extra" jsonb
);
