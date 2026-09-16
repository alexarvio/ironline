CREATE TABLE "food_days" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"date" text,
	"day_type" text,
	"extra" jsonb
);
