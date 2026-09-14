CREATE TABLE "client_gyms" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text,
	"created_at" text,
	"last_used_at" text,
	"archived" boolean,
	"is_home" boolean,
	"extra" jsonb
);
