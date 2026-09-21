CREATE TABLE "meal_photos" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"date" text,
	"meal" text,
	"file_path" text,
	"uploaded_at" text,
	"extra" jsonb
);
