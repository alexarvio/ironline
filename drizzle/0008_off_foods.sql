CREATE TABLE "off_foods" (
	"id" integer PRIMARY KEY NOT NULL,
	"code" text,
	"name" text,
	"brand" text,
	"quantity" text,
	"kcal" double precision,
	"protein" double precision,
	"carbs" double precision,
	"fat" double precision,
	"serving_label" text,
	"serving_grams" double precision,
	"fetched_at" text,
	"extra" jsonb
);
