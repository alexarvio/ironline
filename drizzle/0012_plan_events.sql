CREATE TABLE "client_events" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"kind" text,
	"title" text,
	"start_date" text,
	"end_date" text,
	"note" text,
	"created_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "event_categories" (
	"id" integer PRIMARY KEY NOT NULL,
	"coach_id" integer,
	"label" text,
	"color" text,
	"created_at" text,
	"extra" jsonb
);
