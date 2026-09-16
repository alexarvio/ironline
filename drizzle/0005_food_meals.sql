CREATE TABLE "food_meals" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text,
	"created_at" text,
	"extra" jsonb
);
