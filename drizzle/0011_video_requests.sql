CREATE TABLE "video_requests" (
	"id" integer PRIMARY KEY NOT NULL,
	"client_id" integer,
	"assignment_id" double precision,
	"note" text,
	"requested_at" text,
	"file_path" text,
	"submitted_at" text,
	"seen_at" text,
	"reply_note" text,
	"reply_file_path" text,
	"replied_at" text,
	"reply_seen_at" text,
	"extra" jsonb
);
