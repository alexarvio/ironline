import { getData } from "./db";
import { sendPushInBackground } from "./push";
import { coachIdOfClient } from "./tenancy";
// The kind's name, as the chat lists say it (one source, app/components/ChatLastLine.tsx).
import { MEDIA_NAME, type ChatMediaKind } from "../components/ChatLastLine";

// The coach's phone buzzes (21 Oct): for what a client writes in the chat
// and for a photo or video of an exercise, each opening its place on /coach.
// Sent to every device the coach turned notifications on for (lib/push.ts);
// a quiet no-op while push is off on the server.
//
// Not for a chat the coach is reading on the phone right now: its open thread
// asks the server for itself every 15 s while it shows (coachThreadAction),
// and that ask is noted here. Kept in memory, as the app runs as one server
// process; a restart only means one push too many.

const READING_MS = 25_000;
const reading = new Map<string, number>();
const key = (coachId: number, clientId: number) => `${coachId}:${clientId}`;

/** The coach's phone has this client's chat open and showing. */
export function noteCoachReading(coachId: number, clientId: number) {
  reading.set(key(coachId, clientId), Date.now());
}

const readingNow = (coachId: number, clientId: number) => Date.now() - (reading.get(key(coachId, clientId)) ?? 0) < READING_MS;


/** A client wrote in the chat: their name, the first line (or what they sent), and a tap opens the chat. */
export function pushCoachMessage(clientId: number, message: { text: string; media?: ChatMediaKind | null }) {
  const coachId = coachIdOfClient(clientId);
  if (coachId == null || readingNow(coachId, clientId)) return;
  const name = getData().clients.find((c) => c.id === clientId)?.name?.trim() || "A client";
  const line = message.text.trim().split("\n")[0].slice(0, 160);
  const body = line || (message.media ? MEDIA_NAME[message.media] : "");
  if (!body) return;
  // One notification a chat on the lock screen, the newest words in it.
  sendPushInBackground(coachId, { title: name, body, url: `/coach?c=${clientId}`, tag: `chat:${clientId}` });
}

/** A client's photo or video of an exercise came in: "Video of Squat", and a tap opens it to review. */
export function pushCoachVideo(requestId: number) {
  const data = getData();
  const v = (data.video_requests ?? []).find((x) => x.id === requestId);
  if (!v) return;
  const coachId = coachIdOfClient(v.client_id);
  if (coachId == null) return;
  const name = data.clients.find((c) => c.id === v.client_id)?.name?.trim() || "A client";
  const a = data.workout_assignments.find((w) => w.id === v.assignment_id);
  const exercise = a ? data.exercises.find((e) => e.id === a.exercise_id)?.name : null;
  const what = `${v.media === "photo" ? "Photo" : "Video"} of ${exercise ? (v.about === "swap" ? `a swap for ${exercise}` : exercise) : "an exercise"}`;
  sendPushInBackground(coachId, { title: name, body: what, url: `/coach?v=${requestId}`, tag: `video:${requestId}` });
}
