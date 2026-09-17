CREATE TABLE "saved_days" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text,
	"items" jsonb,
	"created_at" text,
	"extra" jsonb
);
