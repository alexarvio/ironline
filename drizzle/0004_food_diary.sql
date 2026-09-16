CREATE TABLE "custom_foods" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text,
	"kcal" double precision,
	"protein" double precision,
	"carbs" double precision,
	"fat" double precision,
	"serving_label" text,
	"serving_grams" double precision,
	"created_at" text,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "food_entries" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"date" text,
	"meal" text,
	"food_id" text,
	"name" text,
	"grams" double precision,
	"serving" text,
	"kcal" double precision,
	"protein" double precision,
	"carbs" double precision,
	"fat" double precision,
	"logged_at" text,
	"extra" jsonb
);
