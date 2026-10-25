import { getData } from "./db";
import { getLogsForAssignment } from "./queries";
import type { MediaReview, ThreadItem } from "../admin/redesign/media-review/MediaReviewModal";

// The coach's phone (21 Oct, Alex: answer messages and reply to videos, the
// rest stays on the laptop). The chats come from the admin's own loader
// (loadChatDock); this file reads the videos: every photo or video a client
// sent from an exercise, waiting for the coach or already answered, and one
// of them as the review screen draws it, the same MediaReview the laptop's
// review modal takes.

export type PhoneVideo = {
  id: number;
  clientId: number;
  client: string;
  avatarPath: string | null;
  exercise: string;
  /** "Upper — push", or "Session 2" when it has no name. */
  session: string;
  /** "Week 3" inside its programme. */
  week: string | null;
  media: "video" | "photo";
  /** The file, for its thumbnail on the list (25 Oct, Alex). */
  path: string;
  /** The coach asked for it (else the client sent it on their own). */
  asked: boolean;
  sentAt: number;
  repliedAt: number | null;
  /** How the coach answered: a recorded form review, words, or marked done without a reply (25 Oct). */
  reply: "review" | "text" | "done" | null;
};
export type PhoneVideos = { waiting: PhoneVideo[]; replied: PhoneVideo[] };
/** The review screen: the laptop's MediaReview, with what the coach asked for and when they answered. */
export type PhoneReview = MediaReview & { askNote: string | null; repliedAt: number | null; clientId: number };

type Data = ReturnType<typeof getData>;
type Request = Data["video_requests"][number];

const ms = (s: string | null | undefined) => {
  if (!s) return 0;
  const t = new Date(s.includes("T") ? s : s.replace(" ", "T")).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** The exercise, its session and its week, as the Feed names them. */
function placeOf(data: Data, v: Request) {
  const a = data.workout_assignments.find((w) => w.id === v.assignment_id);
  const d = a ? data.program_days.find((x) => x.id === a.program_day_id) : undefined;
  const name = a ? data.exercises.find((e) => e.id === a.exercise_id)?.name ?? "Exercise" : "Exercise";
  const session = d ? (d.free ? "Rogue session" : d.label?.trim() || `Session ${d.day_of_week}`) : "Session";
  const program = d ? data.training_programs.find((p) => p.client_id === d.client_id && d.week_number >= p.start_week && d.week_number < p.start_week + p.total_weeks) : undefined;
  const weekNo = d ? (program ? d.week_number - program.start_week + 1 : d.week_number) : null;
  return { a, d, exercise: v.about === "swap" ? `Swap for ${name}` : name, session, weekNo };
}

/** Every photo or video in from this coach's clients: the ones waiting, longest wait first, then the last 20 answered. */
export function listPhoneVideos(coachId: number): PhoneVideos {
  const data = getData();
  const clients = new Map(data.clients.filter((c) => c.coach_id === coachId).map((c) => [c.id, c] as const));
  const rows: PhoneVideo[] = [];
  for (const v of data.video_requests ?? []) {
    const c = clients.get(v.client_id);
    if (!c || !v.file_path || !v.submitted_at) continue;
    const p = placeOf(data, v);
    rows.push({
      id: v.id,
      clientId: c.id,
      client: c.name ?? "Client",
      avatarPath: c.avatar_path ?? null,
      exercise: p.exercise,
      session: p.session,
      week: p.weekNo != null ? `Week ${p.weekNo}` : null,
      media: v.media === "photo" ? "photo" : "video",
      path: v.file_path,
      asked: !v.from_client,
      sentAt: ms(v.submitted_at),
      repliedAt: v.replied_at ? ms(v.replied_at) : v.closed_at ? ms(v.closed_at) : null,
      reply: v.reply_file_path ? "review" : v.reply_note?.trim() ? "text" : v.closed_at ? "done" : null,
    });
  }
  return {
    waiting: rows.filter((r) => r.repliedAt == null).sort((x, y) => x.sentAt - y.sentAt),
    replied: rows
      .filter((r) => r.repliedAt != null)
      .sort((x, y) => (y.repliedAt ?? 0) - (x.repliedAt ?? 0))
      .slice(0, 20),
  };
}

const LB = 2.20462;
const num = (n: number) => String(Math.round(n * 10) / 10);

/** One photo or video as the review screen draws it; null when it is gone or has no file. */
export function phoneReview(requestId: number): PhoneReview | null {
  const data = getData();
  const v = (data.video_requests ?? []).find((x) => x.id === requestId);
  if (!v || !v.file_path) return null;
  const c = data.clients.find((x) => x.id === v.client_id);
  const p = placeOf(data, v);
  // The sets logged on it: the weight in the unit each was logged in, the unit said once.
  let unitSaid = false;
  const sets = p.a
    ? getLogsForAssignment(p.a.id).map((l) => {
        const lbs = l.unit === "lb";
        const w = l.weight_kg == null ? null : lbs ? Math.round(l.weight_kg * LB * 2) / 2 : l.weight_kg;
        const label = w == null ? `${l.reps ?? "—"} reps` : `${num(w)}${unitSaid ? "" : lbs ? " lbs" : " kg"} × ${l.reps ?? "—"}`;
        if (w != null) unitSaid = true;
        return { n: l.set_number, label };
      })
    : [];
  const thread: ThreadItem[] = [];
  if (v.reply_file_path) thread.push({ id: `r${v.id}`, kind: "review", url: v.reply_file_path, durationMs: v.reply_duration_ms ?? null, annotations: v.reply_annotations ?? null, message: v.reply_note?.trim() || null, at: ms(v.replied_at) });
  else if (v.reply_note?.trim()) thread.push({ id: `n${v.id}`, kind: "text", mine: true, text: v.reply_note.trim(), at: ms(v.replied_at) });
  const name = c?.name ?? "Client";
  return {
    requestId: v.id,
    clientId: v.client_id,
    unseen: !v.seen_at,
    client: { firstName: name.split(/\s+/)[0] || name, name, avatarPath: c?.avatar_path ?? null },
    exercise: { name: p.exercise, session: p.session, week: p.weekNo ?? 0, day: p.d?.day_of_week ?? 1 },
    requested: !v.from_client,
    media: [{ kind: v.media === "photo" ? "photo" : "video", url: v.file_path }],
    sentAt: v.submitted_at ?? null,
    sets,
    clientMessage: v.client_note?.trim() ? { text: v.client_note.trim(), at: v.submitted_at ?? null } : null,
    thread,
    askNote: !v.from_client && v.note?.trim() ? v.note.trim() : null,
    repliedAt: v.replied_at ? ms(v.replied_at) : null,
  };
}
