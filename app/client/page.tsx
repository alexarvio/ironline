import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import { logoutAction } from "../lib/auth-actions";
import {
  getAssignmentsForDay,
  getClient,
  getClientProfile,
  getClientProgramNoteMeta,
  listCardioForDay,
  describeMessageLink,
  listChatMessages,
  isCardioDone,
  getLastMeetingRecap,
  getUpNextSession,
  listCalorieLogs,
  getDeployedProgram,
  getClientExerciseNotes,
  listClientGyms,
  trainingDates,
  homeGymId,
  dayGymId,
  targetAtGym,
  getLogsForAssignment,
  getLastWarmupSets,
  getLastSets,
  getExerciseHistory,
  liveSessionFor,
  listExercises,
  videoRequestsFor,
  listVideoReplies,
  getCurrentWeekNumber,
  getCheckInSections,
  getCheckInHistory,
  getCheckInStatus,
  ensureDefaultMetrics,
  getClientPreferences,
  listClientReports,
  listPublishedWeekNumbers,
  getNotifications,
  getNutritionGoalsSummary,
  getFoodDiary,
  listFoodEntries,
  getNutritionPlan,
  getCurrentPhase,
  getCoachFirstName,
  getCoachDisplayName,
  getCoachEmail,
  getCoachAvatarPath,
  getCoachProfileForClient,
  getStoredNutritionPlan,
  listClientPhases,
  weekStart,
  weeklyCheckInOpen,
  getPhotoCadence,
  getPhotoInstructions,
  getPhotoPeriodNote,
  getPublishedWeek,
  listClients,
  meetingProvider,
  listMeetings,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  localDateStr,
  photoSheetFor,
  upcomingPhotoSheets,
  programWeekLabel,
  slugify,
  SUPPLEMENT_ITEMS,
  VITAMIN_ITEMS,
} from "../lib/queries";
import TrainingDayList from "./TrainingDayList";

import { ProgressPicturesRow, type ProgressPicturesProps } from "./ProgressPicturesScreen";
import HomeHub, { type LatestActivity, type UpcomingMeeting } from "./HomeHub";
import type { PastMeetingView } from "./MeetingsScreen";
import type { ProgressPics } from "./ProgressPicsCard";
import NutritionTargetsCard, { type NutritionTargetSet } from "./NutritionTargetsCard";
import CoachCard from "./CoachCard";
import FitTitle from "./FitTitle";
import PhaseObjectives from "./PhaseObjectives";
import PushToggle from "./PushToggle";
import { pushPublicKey } from "../lib/push";
import SupplementsCard, { type SupplementRow } from "./SupplementsCard";
import ReportArchiveList, { ArchiveReport } from "./ReportArchiveList";
import NotificationRow from "./NotificationRow";
import CoachNotesRow from "./CoachNotesRow";
import DeleteAccountRow from "./DeleteAccountRow";
import MyDetailsCard from "./MyDetailsCard";
import ClientWeekSwitcher from "./ClientWeekSwitcher";
import ProgramNote from "./ProgramNote";
import AppShell, { AppTab } from "./AppShell";
import AvatarUpload from "./AvatarUpload";
import { phaseCovers, phaseDays, phaseLastDay, phaseWeekIndex, phaseWeeks } from "../lib/phases";
import { defaultPhaseCover } from "../lib/phaseCovers";
import type { HomePhase, PhaseFoodToday } from "./PhaseCards";
import {
  AccountIcon,
  AppleIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  DumbbellIcon,
  HomeIcon,
  ReportIcon,
} from "../components/icons";
import {
  markAllNotificationsReadAction,
  setClientPreferenceAction,
} from "../lib/actions";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// A note with no kind set still needs a header — "Note" is the honest
// fallback rather than guessing which of the three it is.
function noteDateLabel(at: string | null): string {
  if (!at) return "";
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Which client the app is showing. There's no login yet, so the admin's
// "View client app" link carries ?client=<id> and this falls back to the
// first client on the books — that fallback is why building a program for
// one client and opening the app showed another's.
// Which client this app is showing is now decided ONLY by the signed session
// cookie. It used to come from ?client=<id>, which meant any logged-in person
// could read another client's entire app by editing the URL. A coach can
// still preview a specific client via ?client=, because requireClientAccess
// grants coaches access to anyone; for a client the parameter is ignored.
async function resolveClientId(raw: string | undefined): Promise<number | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/login/change-password");

  // A coach may preview their own clients' apps, so ?client= still works for
  // them, but only for a client of theirs.
  if (user.role === "coach") {
    const asked = raw ? Number(raw) : null;
    return asked && getClient(asked)?.coach_id === user.id ? asked : listClients(user.id)[0]?.id ?? null;
  }

  // A client gets their own id and nothing else — the parameter is ignored.
  if (user.client_id == null) redirect("/login");
  return user.client_id;
}

const MONTH_CAP = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtShortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MONTH_CAP[d.getMonth()]}`;
};

// Settings' progress-report list is the only place reports appear — a sent
// report's sections_snapshot parsed, plus up to 3 stat deltas derived from
// whichever sections it actually has. No domain knowledge of which
// direction is "good" for a coach-defined metric, so deltas render neutral
// rather than guessing.
type ReportSection = {
  label: string;
  series?: { date: string; value: number }[];
  seriesByField?: Record<string, { unit: string; points: { date: string; value: number }[] }>;
};

function parseReportSections(snapshot: string): ReportSection[] {
  try {
    return JSON.parse(snapshot);
  } catch {
    return [];
  }
}

function deriveReportStats(sections: ReportSection[]): { label: string; value: string }[] {
  const stats: { label: string; value: string }[] = [];
  for (const s of sections) {
    if (stats.length >= 3) break;
    if (s.series && s.series.length >= 2) {
      const delta = s.series[s.series.length - 1].value - s.series[0].value;
      stats.push({ label: s.label, value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` });
    } else if (s.seriesByField) {
      for (const [field, { points, unit }] of Object.entries(s.seriesByField)) {
        if (stats.length >= 3 || points.length < 2) continue;
        const delta = points[points.length - 1].value - points[0].value;
        stats.push({ label: field, value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${unit ? ` ${unit}` : ""}` });
      }
    }
  }
  return stats;
}

function getWeekDays(CLIENT_ID: number, week?: number) {
  // Auto-advances the moment a week the coach has already deployed starts —
  // see getCurrentWeekNumber's doc comment in lib/queries.ts. Callers that
  // want a specific week (the Training tab's week switcher) pass one in.
  const targetWeek = week ?? getCurrentWeekNumber(CLIENT_ID);
  const publishedDays = getPublishedWeek(CLIENT_ID, targetWeek);
  return publishedDays.map((day) => ({ day, assignments: getAssignmentsForDay(day.id) }));
}

// This week's training in one figure, for the top of the Training tab:
// days trained of the days built. (Sets logged used to sit beside it; it
// told the client nothing they could act on, so it went.)
function weekStats(CLIENT_ID: number, week: number) {
  const days = getWeekDays(CLIENT_ID, week);
  const daysTrained = days.filter((d) => d.assignments.some((a) => getLogsForAssignment(a.id).length > 0)).length;
  const totalDays = days.filter((d) => d.assignments.length > 0).length;
  return { daysTrained, totalDays };
}

// A booked call as its card shows it: on Home (the next one) and on the
// Meetings screen (every one still to come).
function meetingCardView(m: ReturnType<typeof listMeetings>[number], today: string): NonNullable<UpcomingMeeting> {
  const when = new Date(`${m.date}T00:00:00`);
  const days = Math.round((when.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  // "Starting now" from ten minutes before the start until the end.
  const startingNow = (() => {
    if (m.date !== today || !m.time) return false;
    const [h, mi] = m.time.split(":").map((n) => Number(n) || 0);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const start = h * 60 + mi;
    return nowMin >= start - 10 && nowMin <= start + m.duration_minutes;
  })();
  return {
    link: m.link ?? null,
    provider: meetingProvider(m.link),
    startingNow,
    startIso: m.time ? `${m.date}T${m.time}:00` : null,
    durationMinutes: m.duration_minutes,
    monthCap: MONTH_CAP[when.getMonth()],
    dayNumber: String(when.getDate()),
    weekdayCap: DAY_LABELS[when.getDay()],
    topic: m.topic || "Check-in call",
    inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
    whenLabel: [
      when.toLocaleDateString("en-US", { weekday: "long" }),
      m.time || null,
    ]
      .filter(Boolean)
      .join(" ") + ` · ${m.duration_minutes} min`,
  };
}

// A call that has happened, for the Meetings screen's log: what it was
// about and the recap the coach wrote for the client (never the coach's
// own prep notes or running notes).
function pastMeetingView(m: ReturnType<typeof listMeetings>[number]): PastMeetingView {
  const when = new Date(`${m.date}T12:00:00`);
  return {
    id: m.id,
    dayNumber: String(when.getDate()),
    monthCap: MONTH_CAP[when.getMonth()],
    dateLabel: when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    topic: m.topic || "Check-in call",
    title: (m.summary_title ?? "").trim() || null,
    text: (m.summary ?? "").trim() || null,
    missed: m.status === "no-show",
  };
}

function HomeTab({ CLIENT_ID, photos, food }: { CLIENT_ID: number; photos: ProgressPics; food: PhaseFoodToday }) {
  const client = getClient(CLIENT_ID);
  const today = localDateStr();

  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const upcoming: UpcomingMeeting = upcomingMeeting ? meetingCardView(upcomingMeeting, today) : null;

  // ---- The check-in, counted the way its screen shows it (today's, plus
  // the week's while its window is open), for the lifestyle card. ----
  ensureDefaultMetrics(CLIENT_ID);
  const sections = getCheckInSections(CLIENT_ID);
  const weeklyOpen = weeklyCheckInOpen(CLIENT_ID);
  const onScreen = sections.sections.filter((s) => s.id === "daily" || weeklyOpen).flatMap((s) => s.metrics);
  const checkInCount = { done: onScreen.filter((m) => m.value !== "").length, total: onScreen.length };

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // The next session, for the training card's Start.
  const session = (() => {
    const s = getUpNextSession(CLIENT_ID);
    if (!s) return null;
    // Weeks in a row with at least one session done, counting back from this one.
    const current = getCurrentWeekNumber(CLIENT_ID);
    let streak = 0;
    for (let w = current; w >= 1; w--) {
      const days = getWeekDays(CLIENT_ID, w).filter((d) => d.assignments.length > 0);
      if (days.length === 0) break;
      const done = days.some(({ day, assignments }) => !!day.session_ended_at || assignments.every((a) => getLogsForAssignment(a.id).length >= a.sets));
      if (!done) {
        if (w === current) continue;
        break;
      }
      streak++;
    }
    return { ...s, streak };
  })();
  // No session left this week on a live programme: when the next week starts.
  const weekDone = (() => {
    if (session || !getDeployedProgram(CLIENT_ID)) return null;
    const next = new Date(`${weekStart(today)}T00:00:00`);
    next.setDate(next.getDate() + 7);
    return { nextWeekLabel: next.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) };
  })();

  // A session ended today: training is done for the day (Quick actions).
  const trainedToday = getDeployedProgram(CLIENT_ID)
    ? getWeekDays(CLIENT_ID, getCurrentWeekNumber(CLIENT_ID)).some(({ day }) => !!day.session_ended_at && localDateStr(new Date(day.session_ended_at)) === today)
    : false;

  const coachFirst = getCoachFirstName(CLIENT_ID);
  // "Your plan": the live phase on each track, in this order; none, no section.
  const phases: HomePhase[] = (["training", "nutrition", "lifestyle"] as const).flatMap((track) => {
    const ph = getCurrentPhase(CLIENT_ID, track);
    if (!ph) return [];
    return [
      {
        id: ph.id,
        track,
        name: ph.name,
        start: ph.start_week,
        end: phaseLastDay(ph.end_week),
        coverUrl: ph.cover_path ?? defaultPhaseCover(track, ph.id),
        objectives: ph.objectives ?? [],
        note: ph.nutrition?.coach_notes?.trim() || null,
      },
    ];
  });
  return (
    <HomeHub
      dateLabel={dateLabel}
      firstName={(client?.name ?? "").trim().split(/\s+/)[0] || "there"}
      coach={{ firstName: coachFirst, photoPath: getCoachAvatarPath(CLIENT_ID) }}
      session={session}
      progressPics={photos}
      latestActivity={latestCoachActivity(CLIENT_ID, coachFirst)}
      upcoming={upcoming}
      recap={getLastMeetingRecap(CLIENT_ID)}
      phases={phases}
      checkInCount={onScreen.length ? checkInCount : null}
      weekDone={weekDone}
      trainedToday={trainedToday}
      today={today}
      food={food}
    />
  );
}

// The date the coach did it, as "21 Sep".
function relativeLabel(iso: string): string {
  return fmtShortDate(iso.slice(0, 10));
}

// The single newest thing the coach did for this client, whatever it was:
// a chat message (with or without a link), a video reply, a programme or
// report, or a note. Nothing yet: a welcome, so the card is never absent.
// Home's "Latest from" card says only what the coach did, never the thing's
// name: "Set a new lifestyle phase", not "…: hyper". Notifications stored
// with the name (or a date, or "Check it out") are cut back to the action;
// the coach's name is already above the title, so "Your coach" goes too.
function actionOnly(message: string): string {
  let t = message.trim().replace(/^your coach\s+/i, "");
  if (/^your call moved/i.test(t)) return "Moved your call";
  if (/^wrote up what you agreed/i.test(t)) return "Wrote up your call";
  if (/^replied to your video/i.test(t)) return "Replied to your video";
  t = t.replace(/\.\s*check (it|them) out\.?$/i, "").replace(/\s*\([^)]*\)\s*$/, "");
  const colon = t.indexOf(":");
  if (colon > 0) t = t.slice(0, colon);
  t = t.replace(/[.\s]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
// What a comment was on, in words: "Commented on your nutrition".
const COMMENT_ON = { nutrition: "your nutrition", checkin: "your check-in", photos: "your progress pictures", training: "your training" } as const;

function latestCoachActivity(clientId: number, coachFirst: string): LatestActivity {
  const weekAgo = Date.now() - 7 * 86400000;
  const sent = coachMessagesFor(clientId).filter((m) => !m.mine && (m.text.trim() || m.media));
  const latestMsg = sent[sent.length - 1] ?? null;
  const notes = getNotifications(clientId).filter((n) => n.kind !== "reminder");
  const latestNote = notes[0] ?? null;
  const msgAt = latestMsg ? new Date(`${latestMsg.dateIso}T${latestMsg.timeLabel}:00`).getTime() : 0;
  const noteAt = latestNote ? new Date(latestNote.created_at).getTime() : 0;
  const more =
    sent.filter((m) => new Date(`${m.dateIso}T00:00:00`).getTime() >= weekAgo).length +
    notes.filter((n) => new Date(n.created_at).getTime() >= weekAgo).length;
  const moreThisWeek = Math.max(0, more - 1);
  const unread = getNotifications(clientId).filter((n) => n.kind === "coach_note" && !n.read).length;

  if (latestMsg && msgAt >= noteAt) {
    const iso = `${latestMsg.dateIso}T${latestMsg.timeLabel}:00`;
    if (latestMsg.link && !latestMsg.link.gone) {
      const k = latestMsg.link.link.kind;
      const context = k === "food" || k === "nutrition" ? "nutrition" : k === "checkin" ? "checkin" : k === "photos" ? "photos" : "training";
      const cta = context === "nutrition" ? "View meal" : context === "checkin" ? "View check-in" : context === "photos" ? "View pictures" : "View session";
      return { kind: "comment", context, title: `Commented on ${COMMENT_ON[context]}`, body: latestMsg.text || null, whenLabel: relativeLabel(iso), cta, link: latestMsg.link, unread, unseen: unread > 0, moreThisWeek };
    }
    return { kind: "message", title: "Sent you a message", body: latestMsg.text || (latestMsg.media ? "Sent you a file" : null), whenLabel: relativeLabel(iso), cta: "Reply", link: latestMsg.link, unread, unseen: unread > 0, moreThisWeek };
  }
  if (latestNote) {
    const when = relativeLabel(latestNote.created_at);
    const base = { whenLabel: when, notificationId: latestNote.id, actionTab: latestNote.action_tab, actionRef: latestNote.action_ref, unread, unseen: !latestNote.read, moreThisWeek };
    if (latestNote.action_tab === "video") {
      const reply = listVideoReplies(clientId).find((r) => r.id === latestNote.action_ref) ?? null;
      return { kind: "video", title: "Replied to your video", body: reply?.replyNote || null, cta: "Watch", videoReply: reply, ...base };
    }
    // The button says where it goes, after what changed: View training,
    // View nutrition, View check-in (a lifestyle phase), and so on.
    const title = actionOnly(latestNote.message);
    if (latestNote.kind === "programme") {
      if (latestNote.action_tab === "nutrition") return { kind: "deploy", track: "nutrition", title, body: null, cta: "View nutrition", ...base };
      if (latestNote.action_tab === "home") return { kind: "comment", context: "checkin", title, body: null, cta: "View check-in", ...base };
      return { kind: "deploy", track: "training", title, body: null, cta: "View training", ...base, actionTab: latestNote.action_tab ?? "training" };
    }
    if (latestNote.kind === "report") return { kind: "report", title: "Sent you a progress report", body: null, cta: "View report", ...base, actionTab: latestNote.action_tab ?? "settings" };
    if (latestNote.action_tab === "nutrition") return { kind: "deploy", track: "nutrition", title, body: null, cta: "View nutrition", ...base };
    // A change the coach made: read what it was from its tab and its words.
    if (latestNote.kind === "general") {
      const lower = latestNote.message.toLowerCase();
      if (latestNote.action_tab === "training") return { kind: "deploy", track: "training", title, body: null, cta: lower.includes("video") ? "View exercise" : "View training", ...base };
      if (lower.includes("goal")) return { kind: "goal", title, body: null, cta: "Open chat", ...base };
      if (lower.includes("call") || lower.includes("meeting")) return { kind: "meeting", title, body: null, cta: "View meeting", ...base };
      if (lower.includes("progress pictures")) return { kind: "comment", context: "photos", title, body: null, cta: "View pictures", ...base, actionTab: latestNote.action_tab ?? "home" };
      if (lower.includes("check in") || lower.includes("check-in")) return { kind: "comment", context: "checkin", title, body: null, cta: "View check-in", ...base, actionTab: latestNote.action_tab ?? "home" };
      if (lower.includes("calendar")) return { kind: "message", title, body: null, cta: "Open chat", ...base };
      return { kind: "message", title, body: null, cta: latestNote.action_label ?? "Open", ...base };
    }
    if (latestNote.action_tab === "chat") return { kind: "message", title: "Sent you a message", body: latestNote.message, cta: "Reply", ...base };
    return { kind: "message", title: latestNote.action_label ?? "Sent you a note", body: latestNote.message, cta: latestNote.action_tab ? "Open" : "Open chat", ...base };
  }
  return {
    kind: "welcome",
    title: `${coachFirst} set up your plan`,
    body: `Your first session is ready. Check in each morning so ${coachFirst} can see how you're going.`,
    whenLabel: "",
    cta: `Meet ${coachFirst}`,
    unread: 0,
    unseen: false,
    moreThisWeek: 0,
  };
}

// The conversation with the coach, oldest first, with the labels the thread
// and Home's card show. Both sides: the client answers from the same screen.
function coachMessagesFor(clientId: number) {
  return listChatMessages(clientId)
    .filter((m) => m.text.trim() || m.media_path)
    .map((m) => {
      const d = new Date(m.created_at);
      return {
        id: m.id,
        mine: m.sender === "client",
        text: m.text,
        media: m.media_path ? { path: m.media_path, type: m.media_type ?? ("image" as const), name: m.media_name ?? null } : null,
        reactions: { coach: m.reactions?.coach ?? null, client: m.reactions?.client ?? null },
        pinned: !!m.pinned,
        edited: !!m.edited_at,
        dateIso: m.created_at.slice(0, 10),
        dayLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        timeLabel: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        link: m.link ? describeMessageLink(clientId, m.link) : null,
      };
    });
}

function TrainingTab({ CLIENT_ID, week, currentWeek, showMyNotes }: { CLIENT_ID: number; week: number; currentWeek: number; showMyNotes: boolean }) {
  const days = getWeekDays(CLIENT_ID, week);
  // The client's note about the whole programme sits between the week's
  // figures and its sessions, outside any day.
  const program = getDeployedProgram(CLIENT_ID);
  const trainingDays = days.filter((d) => d.assignments.length > 0 || listCardioForDay(d.day.id).length > 0);
  const stats = weekStats(CLIENT_ID, week);
  const dayTarget = stats.totalDays || 7;
  // Sessions finished this week: ended on the app, or every set logged and
  // any cardio ticked.
  const sessionsDone = trainingDays.filter(
    ({ day, assignments }) =>
      !!day.session_ended_at || (assignments.every((a) => getLogsForAssignment(a.id).length >= a.sets) && listCardioForDay(day.id).every((c) => isCardioDone(c.id)))
  ).length;
  const pct = Math.round((Math.min(sessionsDone, dayTarget) / dayTarget) * 100);
  // A session skipped with a reason is settled: it is not still "left" to
  // do. It does not count as trained either, so the ring stays honest.
  const skipped = trainingDays.filter(({ day, assignments }) => !!day.skip_reason && !assignments.some((a) => getLogsForAssignment(a.id).length > 0)).length;
  const sessionsLeft = dayTarget - sessionsDone - skipped;
  const ringR = 43;
  const ringC = 2 * Math.PI * ringR;
  const isCurrent = week === currentWeek;
  const isPast = week < currentWeek;

  return (
    <div className="tr-body">
      {/* The week's sessions done, overlapping the banner, with the programme note as its footer row. */}
      {(trainingDays.length > 0 || program) && (
        <section className="tr-days">
          {trainingDays.length > 0 && (
            <div className="tr-days-top">
              <div>
                <div className="tr-label">{isCurrent ? "This week" : `Week ${week - (program?.start_week ?? 1) + 1}`}</div>
                <div className="tr-days-figure">
                  <span className="tr-days-num">{sessionsDone}</span>
                  <span className="tr-days-of">of {dayTarget} sessions</span>
                </div>
                <div className={`tr-days-status${sessionsLeft <= 0 ? " done" : ""}`}>
                  {sessionsLeft <= 0 ? "Week complete" : `${sessionsLeft} session${sessionsLeft === 1 ? "" : "s"} left`}
                </div>
              </div>
              {/* Green once the week is complete, like a finished session's pill. */}
              <div className={`tr-ring${sessionsLeft <= 0 ? " done" : ""}`} role="img" aria-label={`${pct}% of this week's sessions done`}>
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle cx="48" cy="48" r={ringR} fill="none" stroke={sessionsLeft <= 0 ? "#DFF3EA" : "#e6ecf3"} strokeWidth="5" />
                  <circle
                    className="tr-ring-fill"
                    cx="48"
                    cy="48"
                    r={ringR}
                    fill="none"
                    stroke={sessionsLeft <= 0 ? "#2f7a3f" : "#2f5d8f"}
                    strokeWidth="5"
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                    style={
                      {
                        strokeDasharray: ringC,
                        strokeDashoffset: ringC * (1 - pct / 100),
                        strokeOpacity: pct > 0 ? 1 : 0,
                        "--tr-ring-c": ringC,
                      } as React.CSSProperties
                    }
                  />
                </svg>
                <span className="tr-ring-pct">{pct}%</span>
              </div>
            </div>
          )}
          {program && (
            <ProgramNote
              programId={program.id}
              note={(() => {
                const m = getClientProgramNoteMeta(CLIENT_ID, program.id);
                return m ? { text: m.text, dateLabel: new Date(m.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) } : null;
              })()}
              coachName={getCoachFirstName(CLIENT_ID)}
            />
          )}
        </section>
      )}

      {/* The coach's objectives for the training phase, as on its Home card,
          and their note on it. */}
      <PhaseObjectives coachName={getCoachFirstName(CLIENT_ID)} objectives={getCurrentPhase(CLIENT_ID, "training")?.objectives ?? []} />
      {(() => {
        const ph = getCurrentPhase(CLIENT_ID, "training");
        return (
          <CoachCard
            coachName={getCoachFirstName(CLIENT_ID)}
            photoPath={getCoachAvatarPath(CLIENT_ID)}
            note={ph?.client_note?.trim() || null}
            noteDate={ph?.client_note_at ? new Date(ph.client_note_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null}
          />
        );
      })()}

      {days.length === 0 ? (
        <p className="empty-note">Nothing deployed yet. Your coach is still building this week.</p>
      ) : trainingDays.length === 0 ? (
        <p className="empty-note">
          Your coach published this week, but hasn&rsquo;t added any exercises yet. It&rsquo;s all
          rest days for now.
        </p>
      ) : (
        (() => {
          // "My notes" are private to the client: a coach previewing the app
          // gets empty ones.
          const myNotes = showMyNotes ? getClientExerciseNotes(CLIENT_ID) : new Map<number, string>();
          // Gyms: each exercise carries its target and note at every gym, so
          // switching gym in the session changes them without a round trip.
          const gyms = listClientGyms(CLIENT_ID);
          const allGyms = listClientGyms(CLIENT_ID, true);
          const home = homeGymId(CLIENT_ID);
          const notesByGym = new Map(
            allGyms.map((g) => [g.id, showMyNotes ? getClientExerciseNotes(CLIENT_ID, g.id) : new Map<number, string>()] as const)
          );
          const coachId = getClient(CLIENT_ID)?.coach_id ?? null;
          const libraryName = new Map(coachId != null ? listExercises(coachId).map((e) => [e.id, e.name] as const) : []);
          const videoReplies = listVideoReplies(CLIENT_ID);
          return (
            <>
            <div className="tr-sessions-head">
              <h2 className="tr-sessions-title">Sessions</h2>
            </div>
            <div className="tr-sessions">
            <TrainingDayList
              currentWeek={isCurrent}
              pastWeek={isPast}
              coachName={getCoachFirstName(CLIENT_ID)}
              clientName={(getClient(CLIENT_ID)?.name ?? "").trim().split(/\s+/)[0] ?? ""}
              liveSession={liveSessionFor(CLIENT_ID)}
              days={trainingDays.map(({ day, assignments }, i) => {
                const gymId = dayGymId(day.id);
                // Videos the coach asked for in this session.
                const videoAsks = videoRequestsFor(assignments.map((a) => a.id));
                // A removed gym still shows on a session that was trained there.
                const dayGym = allGyms.find((g) => g.id === gymId);
                const dayGyms = dayGym?.archived ? [...gyms, dayGym] : gyms;
                return {
                key: day.id,
                index: i + 1,
                week: week - (program?.start_week ?? 1) + 1,
                gyms: dayGyms.map((g) => ({ id: g.id, name: g.name })),
                gymId,
                // The coach's own name for the session. Without one it is
                // numbered by its place in the week; the weekday is never
                // shown here, so a session skipped to another day still
                // reads correctly.
                title: day.label || `Session ${i + 1}`,
                skipReason: day.skip_reason ?? "",
                startedAt: day.session_started_at ?? null,
                endedAt: day.session_ended_at ?? null,
                sessionNote: day.session_note ?? "",
                cardio: listCardioForDay(day.id).map((c) => ({ id: c.id, name: c.name, time: c.time, pace: c.pace, incline: c.incline, distance: c.distance ?? "", notes: c.notes, done: isCardioDone(c.id) })),
                exercises: assignments.map((a) => ({
                  id: a.id,
                  name: a.exercise_name ?? "Exercise",
                  swap: a.swap
                    ? { libraryExerciseId: a.swap.library_exercise_id, name: (a.swap.library_exercise_id != null ? libraryName.get(a.swap.library_exercise_id) : null) ?? a.swap.custom_name ?? "Another exercise" }
                    : null,
                  alternatives: (a.alternatives ?? []).filter((x) => libraryName.has(x.exercise_id)).map((x) => ({ id: x.exercise_id, name: libraryName.get(x.exercise_id)!, note: x.note })),
                  sets: a.sets,
                  reps: a.reps,
                  targetWeight: a.target_weight_kg,
                  targetRpe: a.rpe_target,
                  tempo: a.tempo,
                  rest: a.rest_seconds ?? null,
                  distance: a.distance ?? null,
                  time: a.time ?? null,
                  // The coach's demo for this prescription wins; the exercise
                  // library's own video is the fallback.
                  videoUrl: a.exercise_video_url ?? a.demo_url ?? null,
                  myNote: myNotes.get(a.exercise_id) ?? "",
                  warmups: (a.warmup_sets ?? []).map((w) => ({ weight: w.weight_kg, reps: w.reps })),
                  lastWarmups: getLastWarmupSets(a.id).map((w) => ({ weight: w.weight_kg, reps: w.reps })),
                  videoRequest: (() => {
                    const r = videoAsks.get(a.id);
                    return r ? { id: r.id, note: r.note, src: r.file_path, sentAt: r.submitted_at, reply: videoReplies.find((x) => x.id === r.id) ?? null } : null;
                  })(),
                  gymTargets: allGyms.length ? Object.fromEntries(allGyms.map((g) => [g.id, targetAtGym(a, g.id, home)])) : undefined,
                  gymNotes: allGyms.length ? Object.fromEntries(allGyms.map((g) => [g.id, notesByGym.get(g.id)?.get(a.exercise_id) ?? ""])) : undefined,
                  logs: getLogsForAssignment(a.id).map((l) => ({
                    id: l.id,
                    setNumber: l.set_number,
                    weight: l.weight_kg,
                    reps: l.reps,
                    rpe: l.rpe_actual,
                  })),
                  note: { text: a.notes, dateLabel: noteDateLabel(a.note_at), unread: !!a.notes && !a.note_read },
                  lastSets: getLastSets(a.id, gymId),
                  history: getExerciseHistory(a.id, 3),
                })),
                };
              })}
            />
            </div>
            </>
          );
        })()
      )}
    </div>
  );
}

function NutritionTab({ CLIENT_ID }: { CLIENT_ID: number }) {
  const summary = getNutritionGoalsSummary(CLIENT_ID);
  const plan = getNutritionPlan(CLIENT_ID);
  const storedPlan = getStoredNutritionPlan(CLIENT_ID);

  const today = localDateStr();
  // Sessions have no weekday: a day counts as a training day once a set was
  // logged on it (the last seven days below read their targets by it).
  const trainedOn = trainingDates(CLIENT_ID);
  const coachName = getCoachFirstName(CLIENT_ID);
  const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return localDateStr(d);
  };
  // Both day types' targets up front, so the tabs switch with no server
  // round trip. A macro's share is of the kcal the three macros make up.
  const targetSet = (kcal: number, protein: number, carbs: number, fats: number): NutritionTargetSet => {
    const macroKcal = protein * 4 + carbs * 4 + fats * 9;
    const share = (grams: number, kcalPerGram: number) => (macroKcal > 0 ? (grams * kcalPerGram) / macroKcal : 0);
    return {
      kcal,
      macros: [
        { id: "protein", name: "Protein", grams: protein, share: share(protein, 4) },
        { id: "carbs", name: "Carbs", grams: carbs, share: share(carbs, 4) },
        { id: "fat", name: "Fat", grams: fats, share: share(fats, 9) },
      ],
    };
  };
  const hasTargets = summary.trainingKcal > 0 || summary.restKcal > 0;
  const training = targetSet(summary.trainingKcal, summary.trainingProtein, summary.trainingCarbs, summary.trainingFats);
  const rest = targetSet(summary.restKcal, summary.restProtein, summary.restCarbs, summary.restFats);

  // The nutrition phase the client is in, named as the coach named it on the
  // Plan tab: which week of it this is, one segment per week, and when it ends.
  const nutritionPhase = getCurrentPhase(CLIENT_ID, "nutrition");
  const phaseSlot = nutritionPhase ? (
    (() => {
      const total = phaseWeeks(nutritionPhase.start_week, nutritionPhase.end_week);
      const current = phaseWeekIndex(nutritionPhase.start_week, nutritionPhase.end_week, today);
      // The bar is one line for the phase's days, filled up to today. With
      // under a week to go, the count switches from weeks to days.
      const totalDays = phaseDays(nutritionPhase.start_week, nutritionPhase.end_week);
      const dayIndex = Math.min(
        totalDays,
        Math.max(1, Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${nutritionPhase.start_week}T00:00:00`).getTime()) / 86400000) + 1)
      );
      const inDays = totalDays - dayIndex < 7;
      return (
        <>
          <div className="nd-phase">
            <div className="nd-phase-titles">
              <div className="nd-kicker">Nutrition</div>
              <FitTitle className="nd-phase-name">{nutritionPhase.name}</FitTitle>
            </div>
          </div>
          <div
            className="nd-progress"
            role="progressbar"
            aria-label={`${nutritionPhase.name}: day ${dayIndex} of ${totalDays}`}
            aria-valuemin={0}
            aria-valuemax={totalDays}
            aria-valuenow={dayIndex}
          >
            <span style={{ width: `${(dayIndex / totalDays) * 100}%` }} />
          </div>
          {/* Under the bar: when it began on the left, how far in on the right. */}
          <div className="nd-timeline-foot">
            <span>Started {short(nutritionPhase.start_week)}</span>
            <span className="nd-phase-week">
              {inDays ? (
                <>
                  Day <b>{dayIndex}</b> of {totalDays}
                </>
              ) : (
                <>
                  Week <b>{current}</b> of {total}
                </>
              )}
            </span>
          </div>
        </>
      );
    })()
  ) : (
    <div className="nd-phase">
      <div className="nd-phase-titles">
        <div className="nd-kicker">Nutrition</div>
        <div className="nd-phase-name">Your targets</div>
      </div>
    </div>
  );

  const supplementRows = SUPPLEMENT_ITEMS.map((item) => ({ item, entry: plan.supplements[slugify(item)] })).filter(
    (r) => r.entry?.quantity
  );
  const vitaminRows = VITAMIN_ITEMS.map((item) => ({ item, entry: plan.vitamins[slugify(item)] })).filter(
    (r) => r.entry?.quantity
  );
  // The coach's own rows from the Nutrition tab's Supplements table (the
  // "Add an item" list). These are the ones a coach actually types today;
  // the two fixed lists above are the older preset grid, kept for plans
  // that still use it. A row with no name is one the coach hasn't filled in.
  const customRows = (plan.supplement_rows ?? [])
    .filter((r) => r.name.trim())
    .map((r) => ({ item: r.name.trim(), quantity: r.quantity, timing: r.timing, notes: r.notes?.trim() ?? "" }));
  const referenceRows = [
    ...customRows,
    ...[...supplementRows, ...vitaminRows].map(({ item, entry }) => ({
      item,
      quantity: entry!.quantity,
      timing: entry!.timing ?? "",
      notes: "",
    })),
  ];

  const supplements: SupplementRow[] = referenceRows.map((r) => ({ name: r.item, quantity: r.quantity, timing: r.timing, notes: r.notes }));


  // The last seven days before today that the client logged, each judged
  // against that day's own target: the deployed nutrition phase the day fell
  // in (else the plan's), training or rest by whether a set was logged that
  // day. Days with nothing logged are not listed.
  const nutritionPhases = listClientPhases(CLIENT_ID).filter((p) => p.track === "nutrition" && !p.draft);
  const kcalOf = (m: { protein: number | null; carbs: number | null; fats: number | null }) => (m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9;
  const targetOn = (date: string, trained: boolean) => {
    const phase = nutritionPhases.find((p) => phaseCovers(p.start_week, p.end_week, date));
    const targets = phase?.nutrition?.day_targets ?? storedPlan.day_targets;
    const kcal = targets ? kcalOf(trained ? targets.training : targets.rest) : trained ? summary.trainingKcal : summary.restKcal;
    return kcal > 0 ? kcal : null;
  };
  const weekAgo = addDays(today, -7);
  const lastWeek = listCalorieLogs(CLIENT_ID, 14)
    .filter((c) => c.date < today && c.date >= weekAgo && c.kcal != null)
    .map((c) => {
      const kcal = c.kcal as number;
      // The day type the client picked when logging; older logs go by sets.
      const trained = c.day_type ? c.day_type === "training" : trainedOn.has(c.date);
      const target = targetOn(c.date, trained);
      const diff = target != null ? kcal - target : null;
      const d = new Date(`${c.date}T00:00:00`);
      const delta =
        diff == null
          ? { text: "–", tone: "" }
          : Math.abs(diff) <= 100
          ? { text: "On target", tone: "ok" }
          : diff > 0
          ? { text: `+${Math.round(diff).toLocaleString("en-US")}`, tone: "over" }
          : { text: `−${Math.round(-diff).toLocaleString("en-US")}`, tone: "under" };
      return {
        date: c.date,
        label: `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`,
        type: trained ? "Training" : "Rest",
        note: c.note ?? "",
        kcal,
        delta,
      };
    });


  return (
    <div className="nd">
      <NutritionTargetsCard
        training={training}
        rest={rest}
        // Always opens on Training day; Rest day is a tap away.
        initialIsTraining
        hasTargets={hasTargets}
        phase={phaseSlot}
        eatenKcal={listFoodEntries(CLIENT_ID, today).reduce((s, e) => s + e.kcal, 0)}
        footer={supplements.length > 0 ? <SupplementsCard date={today} rows={supplements} /> : undefined}
      />

      <div className="nd-body">
        {/* The coach's objectives for the nutrition phase, as on its Home card. */}
        <PhaseObjectives coachName={coachName} objectives={nutritionPhase?.objectives ?? []} />
        <CoachCard
          coachName={coachName}
          photoPath={getCoachAvatarPath(CLIENT_ID)}
          note={plan.coach_notes?.trim() || null}
          noteDate={nutritionPhase ? short(nutritionPhase.start_week) : null}
        />

        <section className="nd-days">
          <div className="nd-section-head">
            <h2 className="nd-card-title">Last 7 days</h2>
          </div>
          <div className="nd-card">
            {lastWeek.length === 0 ? (
              <p className="nd-empty">Nothing logged in the last week yet.</p>
            ) : (
              lastWeek.map((d) => (
                <div key={d.date} className="nd-day">
                  <span>
                    <span className="nd-day-date">{d.label}</span>
                    <span className="nd-day-type">{d.type}</span>
                  </span>
                  <span className="nd-day-note">{d.note}</span>
                  <span className="nd-day-kcal">{d.kcal.toLocaleString("en-US")}</span>
                  <span className={`nd-day-delta ${d.delta.tone}`}>{d.delta.text}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsTab({ CLIENT_ID }: { CLIENT_ID: number }) {
  const client = getClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);
  const prefs = getClientPreferences(CLIENT_ID);

  const sentReports = listClientReports(CLIENT_ID).filter((r) => r.status === "sent");
  const reports: ArchiveReport[] = sentReports.map((r) => {
    const sections = parseReportSections(r.sections_snapshot);
    const summary = r.summary || "";
    const firstSentence = summary.match(/^.*?[.!?](?=\s|$)/)?.[0];
    const chartSection = sections.find((s) => s.series && s.series.length >= 2);
    return {
      id: r.id,
      period: `${fmtShortDate(r.period_start)} – ${fmtShortDate(r.period_end)}`,
      summary: firstSentence || summary,
      body: summary,
      isNew: r.opened_at == null,
      stats: deriveReportStats(sections),
      chart: chartSection
        ? {
            points: chartSection.series!,
            fromLabel: fmtShortDate(chartSection.series![0].date),
            toLabel: fmtShortDate(chartSection.series![chartSection.series!.length - 1].date),
            caption: chartSection.label,
          }
        : null,
    };
  });
  // "1 new · 3 saved" while anything is unopened, otherwise just the count.
  const newReportCount = reports.filter((r) => r.isNew).length;
  const reportCountLabel = `${newReportCount > 0 ? `${newReportCount} new · ` : ""}${reports.length} saved`;

  // Weekly summary and the units toggle are out for now: the summary is
  // not built, and the units live on the Kg | Lbs switch in a session.
  // Push notifications, when this server has keys for them (lib/push.ts).
  const pushKey = pushPublicKey();
  const toggleDefs: { key: "coach_notes" | "checkin_reminders"; label: string; detail: string }[] = [
    { key: "coach_notes", label: "Messages from your coach", detail: `A notification when ${getCoachFirstName(CLIENT_ID)} sends you one` },
    { key: "checkin_reminders", label: "Check-in reminders", detail: "A reminder when a check-in, measurement or photo is due" },
  ];

  return (
    <div className="settings-dark">
      {/* The banner, like the other tabs: who this is, since when, and the photo. */}
      <header className="hm-banner st-banner">
        <div className="st-head">
          <div className="st-who">
            <div className="hm-eyebrow hm-date">Your account</div>
            <h1 className="st-name">{client?.name}</h1>
          </div>
          {/* The photo tile on the right, the + on it saying what it does. */}
          <div className="st-avatar">
            <AvatarUpload clientId={CLIENT_ID} name={client?.name ?? ""} avatarPath={client?.avatar_path ?? null} />
          </div>
        </div>
      </header>

      <div className="st-body">
      {/* The coach's profile row is out of Settings for now (nice to have,
          not yet); the profile screen and its data stay in place. */}
      <MyDetailsCard clientId={CLIENT_ID} email={profile.email ?? null} phone={profile.phone ?? null} address={profile.address ?? null} />

      <section className="home-dark-section">
        <div className="home-dark-rows">
          <ProgressPicturesRow />
        </div>
      </section>

      <section className="home-dark-section">
        <div className="home-dark-section-head">
          <span className="home-dark-section-title">Progress reports</span>
          {reports.length > 0 && <span className="home-dark-section-count">{reportCountLabel}</span>}
        </div>
        {reports.length === 0 ? (
          <p className="home-dark-empty">No reports sent yet.</p>
        ) : (
          <ReportArchiveList reports={reports} />
        )}
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Preferences</span>
        <div className="home-dark-rows">
          {pushKey && <PushToggle publicKey={pushKey} />}
          {toggleDefs.map((t) => {
            const on = prefs[t.key];
            return (
              <form key={t.key} action={setClientPreferenceAction}>
                <input type="hidden" name="clientId" value={CLIENT_ID} />
                <input type="hidden" name="key" value={t.key} />
                <input type="hidden" name="value" value={(!on).toString()} />
                <button type="submit" className="settings-toggle-row">
                  <div className="home-dark-row-body">
                    <div className="home-dark-row-title">{t.label}</div>
                    <div className="home-dark-row-detail">{t.detail}</div>
                  </div>
                  <span className={`settings-switch${on ? " on" : ""}`} aria-hidden="true">
                    <span className="settings-switch-knob" />
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Connected apps</span>
        <div className="home-dark-rows">
          <div className="settings-app-row">
            <div className="home-dark-row-body">
              <div className="home-dark-row-title">Apple Health</div>
              <div className="home-dark-row-detail">Auto-log steps, weight & workouts</div>
            </div>
            <span className="st-soon">Soon</span>
          </div>
          <div className="settings-app-row">
            <div className="home-dark-row-body">
              <div className="home-dark-row-title">Health Connect</div>
              <div className="home-dark-row-detail">Auto-log steps, weight & workouts</div>
            </div>
            <span className="st-soon">Soon</span>
          </div>
        </div>
        <div className="home-dark-empty st-note">Health syncing needs the Ironline mobile app (not available on web).</div>
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Data</span>
        <p className="st-note st-privacy">Your coach sees your check-ins, photos, logs and notes. Nobody else does.</p>
        <div className="home-dark-rows">
          <div className="settings-data-row">
            <div className="home-dark-row-title">Export my data</div>
            <span className="st-soon">Soon</span>
          </div>
          {/* The public page (/privacy), in a new tab so the app stays where it was. */}
          <a className="settings-data-row st-link-row" href="/privacy" target="_blank" rel="noopener noreferrer">
            <div className="home-dark-row-title">Privacy policy</div>
            <span className="st-link-go" aria-hidden="true">›</span>
          </a>
          <DeleteAccountRow coachName={getCoachFirstName(CLIENT_ID)} />
        </div>
      </section>

      <form action={logoutAction}>
        <button type="submit" className="settings-logout-btn">
          Log out
        </button>
      </form>
      <div className="settings-footnote">Ironline · Full Potential Coaching</div>
      </div>
    </div>
  );
}


const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  coach_note: "Coach note",
  report: "Progress report",
  programme: "Programme",
  reminder: "Reminder",
  general: "Update",
};

function notificationIcon(kind: string) {
  switch (kind) {
    case "report":
      return <ReportIcon />;
    case "programme":
      return <CalendarIcon />;
    case "reminder":
      return <ClockIcon />;
    default:
      return <ChatIcon />;
  }
}

function notificationTimeLabel(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Notifications sub-view — grouped Today/Earlier, each row a self-submitting
// form (mark-read on tap, same auto-submit pattern used elsewhere in this
// app, e.g. PhotoUploadBox) rather than client-side state.
function NotificationsPanel({ CLIENT_ID }: { CLIENT_ID: number }) {
  const all = getNotifications(CLIENT_ID);
  // The coach's messages sit apart, as one row at the top that opens their
  // own feed; the list under it is everything else.
  const coachNotes = all.filter((n) => n.kind === "coach_note");
  const notifications = all.filter((n) => n.kind !== "coach_note");
  // Replies to the client's videos, opened straight from their notification.
  const videoReplies = listVideoReplies(CLIENT_ID);
  const coachName = getCoachDisplayName(CLIENT_ID);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const todayStr = localDateStr();
  const groups = [
    { label: "Today", items: notifications.filter((n) => n.created_at.slice(0, 10) === todayStr) },
    { label: "Earlier", items: notifications.filter((n) => n.created_at.slice(0, 10) !== todayStr) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="cn-notifications">
      <CoachNotesRow
        coachName={coachName}
        initial={coachName.charAt(0).toUpperCase() || "C"}
        photoPath={getCoachAvatarPath(CLIENT_ID)}
        unread={coachNotes.filter((n) => !n.read).length}
        total={coachNotes.length}
      />

      {groups.length === 0 ? (
        <p className="cn-empty">{coachNotes.length > 0 ? "No other notifications." : "No notifications yet."}</p>
      ) : (
        groups.map((g, i) => (
          <section key={g.label} className="cn-notif-group">
            {/* Mark all as read shares the first group's label line. */}
            <div className="cn-notif-group-head">
              <span className="cn-notif-group-label">{g.label}</span>
              {i === 0 && (
                <form action={markAllNotificationsReadAction}>
                  <input type="hidden" name="clientId" value={CLIENT_ID} />
                  <button type="submit" className="cn-markall" disabled={unreadCount === 0 && coachNotes.every((n) => n.read)}>
                    Mark all as read
                  </button>
                </form>
              )}
            </div>
            <div className="cn-notif-list">
              {g.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  id={n.id}
                  actionTab={n.action_tab}
                  actionRef={n.action_ref}
                  videoReply={n.action_tab === "video" ? videoReplies.find((r) => r.id === n.action_ref) ?? null : null}
                >
                  <span className={`cn-notif-icon${n.read ? "" : " unread"}`} aria-hidden="true">
                    {notificationIcon(n.kind)}
                  </span>
                  <span className="cn-notif-body">
                    <span className="cn-notif-top">
                      <span className="cn-notif-kind">{NOTIFICATION_KIND_LABEL[n.kind] ?? "Update"}</span>
                      <span className="cn-notif-time">{notificationTimeLabel(n.created_at)}</span>
                    </span>
                    <span className={`cn-notif-text${n.read ? "" : " unread"}`}>{n.message}</span>
                    {n.action_label && <span className="cn-notif-action">{n.action_label}</span>}
                  </span>
                  {!n.read && <span className="cn-notif-dot" aria-hidden="true" />}
                </NotificationRow>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="cn-footnote">Turn individual alerts on or off in Settings → Preferences.</div>
    </div>
  );
}

// ---- Progress pictures screen --------------------------------------------
// Everything the pushed Progress pictures screen shows, from the sheet
// schedule the coach set: the sheet open now with its angles, and every
// earlier sheet with the coach's notes on it.

// "September sheet" on a monthly schedule; the opening day otherwise.
function sheetTitle(period: string, cadence: ReturnType<typeof getPhotoCadence>) {
  const d = new Date(`${period}T00:00:00`);
  return cadence === "monthly" ? `${MONTH_LONG[d.getMonth()]} sheet` : `Sheet of ${d.getDate()} ${MONTH_CAP[d.getMonth()]}`;
}

function progressPicturesData(CLIENT_ID: number): ProgressPicturesProps {
  const cadence = getPhotoCadence(CLIENT_ID);
  const today = localDateStr();
  const slots = listPhotoSlots(CLIENT_ID);
  const active = slots.filter((s) => !s.paused);
  const uploads = listPhotoUploads(slots.map((s) => s.id));
  const srcFor = (slotId: number, period: string) =>
    uploads.find((u) => u.slot_id === slotId && u.period === period)?.file_path ?? null;
  const noteFor = (period: string) => {
    const n = getPhotoPeriodNote(CLIENT_ID, period);
    return { shape: n.shape, strengths: n.strengths, improvements: n.improvements, next_steps: n.next_steps };
  };

  const openPeriod = active.length > 0 ? photoSheetFor(CLIENT_ID, today) : null;
  const earlier = listPhotoPeriods(slots.map((s) => s.id))
    .filter((p) => p !== openPeriod)
    .map((period) => ({
      period,
      title: sheetTitle(period, cadence),
      // A sheet keeps any paused angle it already has a photo for.
      photos: slots
        .filter((s) => !s.paused || srcFor(s.id, period))
        .map((s) => ({ slotId: s.id, label: s.label, src: srcFor(s.id, period) })),
      note: noteFor(period),
    }));
  const oldest = earlier[earlier.length - 1];
  const next = active.length > 0 ? upcomingPhotoSheets(CLIENT_ID, today, 1)[0] : null;

  return {
    clientId: CLIENT_ID,
    openSheet: openPeriod
      ? {
          period: openPeriod,
          title: sheetTitle(openPeriod, cadence),
          openedLabel: fmtShortDate(openPeriod),
          slots: active.map((s) => ({ id: s.id, label: s.label, src: srcFor(s.id, openPeriod) })),
          instructions: getPhotoInstructions(CLIENT_ID),
          // The coach's notes on the sheet open now, as soon as they write them.
          note: noteFor(openPeriod),
        }
      : null,
    earlier,
    earlierSince: oldest ? MONTH_LONG[new Date(`${oldest.period}T00:00:00`).getMonth()] : null,
    nextLabel: next ? fmtShortDate(next) : null,
    hasAngles: slots.length > 0,
  };
}

export default async function ClientPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  const CLIENT_ID = await resolveClientId(params.client);
  // Only the client themselves sees their private "My notes", never a coach
  // previewing the app.
  const viewerIsClient = (await getSessionUser())?.role === "client";
  if (CLIENT_ID == null) {
    return (
      <div className="phone-frame">
        <div className="app-screen">
          <p className="app-lead" style={{ padding: 24 }}>
            No clients yet. Add one in the admin panel first.
          </p>
        </div>
      </div>
    );
  }
  const client = getClient(CLIENT_ID);
  // The Check-in screen's three sections, the measurement deltas and this
  // period's photo slots. Built here rather than in HomeTab because the
  // screen is a full-screen push view owned by AppShell.
  const checkInData = getCheckInSections(CLIENT_ID);
  // Same source Home reads, so the tab dots and Home's count can't disagree.
  const checkInStatusForScreen = getCheckInStatus(CLIENT_ID);
  // Home's progress-pictures card, from the same sheet the check-in shows:
  // due while the open sheet is missing angles (none or some), Completed for
  // the rest of the local day its last angle went in, and gone otherwise.
  // The total is the coach's sheet, never a fixed five.
  const photoCount = checkInData.photoSlots.length;
  const photosIn = checkInData.photoSlots.filter((p) => p.src).length;
  const lastPhotoDay = (() => {
    const period = photoSheetFor(CLIENT_ID, localDateStr());
    const latest = listPhotoUploads(listPhotoSlots(CLIENT_ID).map((s) => s.id))
      .filter((u) => u.period === period)
      .map((u) => u.uploaded_at)
      .sort()
      .at(-1);
    return latest ? localDateStr(new Date(latest)) : null;
  })();
  const homePhotos: ProgressPics = checkInData.photosDue
    ? { status: "due", uploaded: photosIn, total: photoCount, coverUrl: null }
    : photoCount > 0 && photosIn === photoCount && lastPhotoDay === localDateStr()
    ? { status: "completed", uploaded: photoCount, total: photoCount, coverUrl: null }
    : null;
  const checkIn = {
    dateLabel: new Date(`${localDateStr()}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    today: localDateStr(),
    sections: checkInData.sections,
    dueSections: checkInStatusForScreen.dueTypes as string[],
    weeklyOpen: weeklyCheckInOpen(CLIENT_ID),
    objectives: getCurrentPhase(CLIENT_ID, "lifestyle")?.objectives ?? [],
    history: getCheckInHistory(CLIENT_ID),
  };
  const progressPictures = progressPicturesData(CLIENT_ID);
  const hasUnreadNotifications = getNotifications(CLIENT_ID).some((n) => !n.read);

  const currentWeekNum = getCurrentWeekNumber(CLIENT_ID);
  // Only the currently deployed program's own weeks — not every published
  // week_number ever (a superseded program's weeks would otherwise mix in
  // and, worse, collide on the same "Week 1" label as the current one; see
  // programWeekLabel in lib/queries.ts).
  const deployedProgram = getDeployedProgram(CLIENT_ID);
  const trainingWeeks = deployedProgram
    ? Array.from({ length: deployedProgram.total_weeks }, (_, i) => deployedProgram.start_week + i)
    : listPublishedWeekNumbers(CLIENT_ID).length > 0
    ? listPublishedWeekNumbers(CLIENT_ID)
    : [currentWeekNum];
  const trainingWeekLabels = deployedProgram
    ? Object.fromEntries(trainingWeeks.map((w) => [w, programWeekLabel(deployedProgram, w)]))
    : undefined;
  const trainingWeekContents = Object.fromEntries(trainingWeeks.map((w) => [w, <TrainingTab key={w} CLIENT_ID={CLIENT_ID} week={w} currentWeek={currentWeekNum} showMyNotes={viewerIsClient} />]));
  // A week is complete when every planned set on every training day is
  // logged — the same rule TrainingTab's progress ring uses for 100%.
  const completedWeeks = trainingWeeks.filter((w) => {
    const trainingDays = getWeekDays(CLIENT_ID, w).filter((d) => d.assignments.length > 0);
    return (
      trainingDays.length > 0 &&
      // A day skipped with a reason is settled, the same as a finished one.
      trainingDays.every((d) => !!d.day.skip_reason || d.assignments.every((a) => getLogsForAssignment(a.id).length >= a.sets))
    );
  });

  // The Training banner: the programme's name, one line for how far through
  // the programme the client is (by days, from the week it was deployed),
  // when it started and which week this is. The week chips join it at the
  // foot, inside ClientWeekSwitcher. The app's top bar floats over its top.
  const trainingBanner = (() => {
    const today = localDateStr();
    const start = deployedProgram?.deployed_at ? weekStart(deployedProgram.deployed_at.slice(0, 10)) : null;
    const totalDays = deployedProgram ? deployedProgram.total_weeks * 7 : 0;
    const elapsedDays = start
      ? Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1
      : 0;
    const elapsedPct = totalDays ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;
    const weekIndex = deployedProgram ? Math.min(deployedProgram.total_weeks, Math.max(1, currentWeekNum - deployedProgram.start_week + 1)) : null;
    return (
      <>
        <div className="tr-kicker">Programme</div>
        <FitTitle className="tr-name">{deployedProgram?.name || "Your programme"}</FitTitle>
        {deployedProgram && start && (
          <>
            <div
              className="tr-progress"
              role="progressbar"
              aria-label="How far through the programme"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(elapsedPct)}
            >
              <span style={{ width: `${elapsedPct}%` }} />
            </div>
            <div className="tr-progress-foot">
              <span>Started {new Date(`${start}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <span>
                Week <b>{weekIndex}</b> of {deployedProgram.total_weeks}
              </span>
            </div>
          </>
        )}
      </>
    );
  })();

  // Today's food diary, opened from the ring on Nutrition.
  const foodDiary = getFoodDiary(CLIENT_ID, localDateStr());

  // The Meetings screen: every call still to come (soonest first), then the
  // ones that happened (newest first). Cancelled calls are left out.
  const meetings = (() => {
    const today = localDateStr();
    const all = listMeetings(CLIENT_ID).filter((m) => m.status !== "cancelled");
    const upcoming = all
      .filter((m) => m.status === "scheduled" && m.date >= today)
      .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))
      .map((m) => meetingCardView(m, today));
    const past = all.filter((m) => m.status !== "scheduled" || m.date < today).map(pastMeetingView);
    return { upcoming, past };
  })();

  const tabs: AppTab[] = [
    // Draws its own light banner (name and main goal); the top bar floats over it.
    { id: "home", label: "Home", icon: <HomeIcon />, bare: true, content: <HomeTab CLIENT_ID={CLIENT_ID} photos={homePhotos} food={{ eaten: foodDiary.eaten.kcal, target: foodDiary.target?.kcal ?? null, mealsLogged: foodDiary.meals.filter((m) => m.entries.length > 0).length, mealsTotal: foodDiary.meals.length }} /> },
    {
      id: "training",
      label: "Training",
      icon: <DumbbellIcon />,
      // Draws its own light banner; the top bar floats over it.
      bare: true,
      darkBanner: true,
      content: (
        <div className="tr">
          <ClientWeekSwitcher
            weeks={trainingWeeks}
            currentWeek={currentWeekNum}
            contents={trainingWeekContents}
            weekLabels={trainingWeekLabels}
            completedWeeks={completedWeeks}
            banner={trainingBanner}
          />
        </div>
      ),
    },
    {
      id: "nutrition",
      label: "Nutrition",
      icon: <AppleIcon />,
      // Draws its own photo banner, darkened; the top bar floats over it in white.
      bare: true,
      darkBanner: true,
      content: <NutritionTab CLIENT_ID={CLIENT_ID} />,
    },
    // Draws its own light banner (name, since when, the photo); the top bar floats over it.
    { id: "settings", label: "Settings", icon: <AccountIcon />, bare: true, content: <SettingsTab CLIENT_ID={CLIENT_ID} /> },
  ];

  return (
    <AppShell
      clientName={client?.name ?? ""}
      tabs={tabs}
      notificationsContent={<NotificationsPanel CLIENT_ID={CLIENT_ID} />}
      hasUnreadNotifications={hasUnreadNotifications}
      clientId={CLIENT_ID}
      checkIn={checkIn}
      photos={progressPictures}
      coachMessages={{ coachName: getCoachDisplayName(CLIENT_ID), messages: coachMessagesFor(CLIENT_ID), viewerIsClient }}
      helpEmail={getCoachEmail(CLIENT_ID)}
      coachProfile={getCoachProfileForClient(CLIENT_ID)}
      coachAvatarPath={getCoachAvatarPath(CLIENT_ID)}
      foodDiary={foodDiary}
      meetings={meetings}
    />
  );
}
