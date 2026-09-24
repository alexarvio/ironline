import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import { logoutAction } from "../lib/auth-actions";
import {
  getAssignmentsForDay,
  getClient,
  getClientProfile,
  getClientPlanView,
  getClientProgramNoteMeta,
  listCardioForDay,
  describeMessageLink,
  listChatMessages,
  isCardioDone,
  getLastMeetingRecap,
  getUpNextSession,
  getCalorieLog,
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
  listLiveProgramVideoReplies,
  getCurrentWeekNumber,
  getCheckInSections,
  getCheckInStatus,
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
  getPhotoCadence,
  getPhotoInstructions,
  getPhotoPeriodNote,
  getPublishedWeek,
  listClients,
  meetingProvider,
  getGoalViews,
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
import HomeHub, { HomePhotos, HomeTrack, UpcomingMeeting } from "./HomeHub";
import NutritionTargetsCard, { type NutritionTargetSet } from "./NutritionTargetsCard";
import CoachCard from "./CoachCard";
import SupplementsCard, { type SupplementRow } from "./SupplementsCard";
import ReportArchiveList, { ArchiveReport } from "./ReportArchiveList";
import NotificationRow from "./NotificationRow";
import CoachNotesRow from "./CoachNotesRow";
import DeleteAccountRow from "./DeleteAccountRow";
import MyDetailsCard from "./MyDetailsCard";
import ClientWeekSwitcher from "./ClientWeekSwitcher";
import ProgramNote from "./ProgramNote";
import CoachVideos from "./CoachVideos";
import AppShell, { AppTab } from "./AppShell";
import AvatarUpload from "./AvatarUpload";
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

// ---- The coach's plan, flattened for Home's profile card ----------------
// One row per track in a fixed order, each showing the phase running now
// (or the next one due to start) with how far through it the client is.
const HOME_TRACK_ORDER = ["nutrition", "training", "lifestyle"] as const;
const DAY_MS = 86400000;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysApart = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY_MS);
const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const countWord = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** "8 weeks" from a week or more, rounded up; "6 days" under one. */
const spanWords = (days: number) => (days >= 7 ? countWord(Math.ceil(days / 7), "week") : countWord(days, "day"));

function homeTracks(plan: ReturnType<typeof getClientPlanView>, clientId: number): HomeTrack[] {
  if (!plan) return [];
  const raw = listClientPhases(clientId).filter((ph) => !ph.draft);
  const today = plan.today;
  return HOME_TRACK_ORDER.map((id) => {
    const t = plan.tracks.find((x) => x.track === id);
    if (!t) return null;
    const sorted = [...t.phases].sort((a, b) => (a.startWeek < b.startWeek ? -1 : 1));
    const running = sorted.find((ph) => ph.startWeek <= today && addDaysIso(ph.endWeek, 6) >= today) ?? null;
    const shown = running ?? sorted.find((ph) => ph.startWeek > today) ?? null;
    if (!shown) return null;
    const weekTotal = shown.weeks;
    const totalDays = weekTotal * 7;
    let timeLeft: string;
    let doneDays = 0;
    if (running) {
      const remaining = daysApart(today, addDaysIso(shown.endWeek, 6)) + 1;
      timeLeft = remaining <= 1 ? "Last day" : `${spanWords(remaining)} to go`;
      doneDays = Math.min(totalDays, Math.max(0, daysApart(shown.startWeek, today)));
    } else {
      timeLeft = `Starts in ${spanWords(daysApart(today, shown.startWeek))}`;
    }
    return {
      track: id,
      label: t.label,
      phaseName: shown.name,
      timeLeft,
      weekNow: Math.min(weekTotal, Math.floor(doneDays / 7) + 1),
      weekTotal,
      progress: totalDays > 0 ? doneDays / totalDays : 0,
      upNext: sorted.find((ph) => ph.startWeek > shown.endWeek)?.name ?? null,
      coachNote: raw.find((ph) => ph.track === id && ph.start_week === shown.startWeek && ph.name === shown.name)?.nutrition?.coach_notes?.trim() || null,
    };
  }).filter((r): r is HomeTrack => !!r);
}

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

function HomeTab({ CLIENT_ID, photos }: { CLIENT_ID: number; photos: HomePhotos }) {
  const client = getClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);
  // Home's header keeps the goal countdown to whole weeks ("11 weeks to
  // goal") so it reads as one line next to the phase/week label instead of
  // wrapping — getTimeToGoal's day-precision string (e.g. "11 weeks 5d") is
  // still what the coach sees in admin's Start Page, unchanged.
  const goalNote = (() => {
    if (!profile.goal_date) return null;
    const days = Math.round(
      (new Date(`${profile.goal_date}T00:00:00`).getTime() - new Date(`${localDateStr()}T00:00:00`).getTime()) / 86400000
    );
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
    if (days === 0) return "Goal date is today";
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} to goal`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} to goal`;
  })();

  const today = localDateStr();

  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const upcoming: UpcomingMeeting = (() => {
    if (!upcomingMeeting) return null;
    const when = new Date(`${upcomingMeeting.date}T00:00:00`);
    const days = Math.round((when.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    // "Starting now" from ten minutes before the start until the end.
    const startingNow = (() => {
      if (upcomingMeeting.date !== today || !upcomingMeeting.time) return false;
      const [h, mi] = upcomingMeeting.time.split(":").map((n) => Number(n) || 0);
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const start = h * 60 + mi;
      return nowMin >= start - 10 && nowMin <= start + upcomingMeeting.duration_minutes;
    })();
    return {
      link: upcomingMeeting.link ?? null,
      provider: meetingProvider(upcomingMeeting.link),
      startingNow,
      monthCap: MONTH_CAP[when.getMonth()],
      dayNumber: String(when.getDate()),
      weekdayCap: DAY_LABELS[when.getDay()],
      topic: upcomingMeeting.topic || "Check-in call",
      inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
      whenLabel: [
        when.toLocaleDateString("en-US", { weekday: "long" }),
        upcomingMeeting.time || null,
      ]
        .filter(Boolean)
        .join(" ") + ` · ${upcomingMeeting.duration_minutes} min`,
    };
  })();

  // ---- "Today" due items (was the Check-ins tab; folded into Home) ----
  // Computation itself lives in getDueItems() in lib/queries.ts, shared with
  // applyDueClientReminders() so the notification feed's reminders and this
  // list never disagree on what's due. dailyDefs/weeklyDefs/*LoggedToday are
  // still needed here directly for the Tracker sub-tab below.
  const checkInStatus = getCheckInStatus(CLIENT_ID);

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // The coach's phase timeline, if they have drawn one, drives the plan
  // rows under the header. The headline itself is the coach's main goal.
  const plan = getClientPlanView(CLIENT_ID);

  return (
    <HomeHub
      dateLabel={dateLabel}
      firstName={(client?.name ?? "").trim().split(/\s+/)[0] || "there"}
      photoUrl={client?.avatar_path ?? null}
      initial={(client?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
      mainGoal={profile.main_goal ?? null}
      tracks={homeTracks(plan, CLIENT_ID)}
      session={getUpNextSession(CLIENT_ID)}
      goals={getGoalViews(CLIENT_ID)}
      upcoming={upcoming}
      recap={getLastMeetingRecap(CLIENT_ID)}
      checkInStatus={checkInStatus}
      photos={photos}
      latestMessage={(() => {
        // The card on Home shows the coach's newest, with how many of theirs there are.
        const sent = coachMessagesFor(CLIENT_ID).filter((m) => !m.mine && m.text.trim());
        const latest = sent[sent.length - 1];
        return latest
          ? { coachName: getCoachDisplayName(CLIENT_ID), text: latest.text, whenLabel: fmtShortDate(latest.dateIso), count: sent.length, link: latest.link }
          : null;
      })()}
    />
  );
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
  // The week's dates, from the programme's start.
  const range = (() => {
    if (!program?.deployed_at) return null;
    const start = new Date(`${weekStart(program.deployed_at.slice(0, 10))}T00:00:00`);
    start.setDate(start.getDate() + (week - program.start_week) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const f = (d: Date, month: boolean) => d.toLocaleDateString("en-GB", month ? { day: "numeric", month: "short" } : { day: "numeric" });
    return start.getMonth() === end.getMonth() ? `${f(start, false)} – ${f(end, true)}` : `${f(start, true)} – ${f(end, true)}`;
  })();

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

      <CoachVideos coachName={getCoachFirstName(CLIENT_ID)} videos={listLiveProgramVideoReplies(CLIENT_ID)} />

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
          const library = coachId != null ? listExercises(coachId).map((e) => ({ id: e.id, name: e.name })) : [];
          const libraryName = new Map(library.map((e) => [e.id, e.name]));
          const videoReplies = listVideoReplies(CLIENT_ID);
          return (
            <>
            <div className="tr-sessions-head">
              <h2 className="tr-sessions-title">Sessions</h2>
              {range && <span className="tr-sessions-count">{range}</span>}
            </div>
            <div className="tr-sessions">
            <TrainingDayList
              currentWeek={isCurrent}
              pastWeek={isPast}
              coachName={getCoachFirstName(CLIENT_ID)}
              library={library}
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
  // Sessions have no weekday, so today is a training day once the client has
  // logged a set today; the Training day / Rest day tabs switch either way.
  const trainedOn = trainingDates(CLIENT_ID);
  const isTrainingDay = trainedOn.has(today);
  const coachName = getCoachFirstName(CLIENT_ID);
  const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return localDateStr(d);
  };
  const weeksBetween = (a: string, b: string) =>
    Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / (7 * 86400000));

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
      const total = weeksBetween(nutritionPhase.start_week, nutritionPhase.end_week) + 1;
      const current = Math.min(total, Math.max(1, weeksBetween(nutritionPhase.start_week, weekStart(today)) + 1));
      // The bar is one line for the phase's days, filled up to today. With
      // under a week to go, the count switches from weeks to days.
      const totalDays = total * 7;
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
              <div className="nd-phase-name">{nutritionPhase.name}</div>
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

  const todayLog = getCalorieLog(CLIENT_ID, today);

  // The last seven days before today that the client logged, each judged
  // against that day's own target: the deployed nutrition phase the day fell
  // in (else the plan's), training or rest by whether a set was logged that
  // day. Days with nothing logged are not listed.
  const nutritionPhases = listClientPhases(CLIENT_ID).filter((p) => p.track === "nutrition" && !p.draft);
  const kcalOf = (m: { protein: number | null; carbs: number | null; fats: number | null }) => (m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9;
  const targetOn = (date: string, trained: boolean) => {
    const week = weekStart(date);
    const phase = nutritionPhases.find((p) => p.start_week <= week && p.end_week >= week);
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
  const onTarget = lastWeek.filter((d) => d.delta.tone === "ok").length;


  return (
    <div className="nd">
      <NutritionTargetsCard
        training={training}
        rest={rest}
        // Opens on the day type the client logged today, else on whether a
        // set was logged today.
        initialIsTraining={todayLog?.day_type ? todayLog.day_type === "training" : isTrainingDay}
        hasTargets={hasTargets}
        phase={phaseSlot}
        eatenKcal={listFoodEntries(CLIENT_ID, today).reduce((s, e) => s + e.kcal, 0)}
        footer={supplements.length > 0 ? <SupplementsCard date={today} rows={supplements} /> : undefined}
      />

      <div className="nd-body">
        <CoachCard
          coachName={coachName}
          photoPath={getCoachAvatarPath(CLIENT_ID)}
          note={plan.coach_notes?.trim() || null}
          noteDate={nutritionPhase ? `Since ${short(nutritionPhase.start_week)}` : null}
        />

        <section className="nd-days">
          <div className="nd-section-head">
            <h2 className="nd-card-title">Last 7 days</h2>
            {lastWeek.length > 0 && (
              <span className="nd-card-count">
                <b>{onTarget}</b> of 7 on target
              </span>
            )}
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
          <div className="settings-data-row">
            <div className="home-dark-row-title">Privacy policy</div>
            <span className="st-soon">Soon</span>
          </div>
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
  // a prompt while it is missing photos, "sent" once every angle is in, and
  // nothing when no sheet is open (no photo is ever filed outside one).
  const photoCount = checkInData.photoSlots.length;
  // "Sent" shows on Home for a day after the last photo of the sheet went
  // in, as a tick where the reminder was; after that Home says nothing
  // about pictures until the next sheet opens.
  const photosSentRecently = (() => {
    const period = photoSheetFor(CLIENT_ID, localDateStr());
    const latest = listPhotoUploads(listPhotoSlots(CLIENT_ID).map((s) => s.id))
      .filter((u) => u.period === period)
      .map((u) => u.uploaded_at)
      .sort()
      .at(-1);
    return !!latest && Date.now() - new Date(latest).getTime() < 24 * 60 * 60 * 1000;
  })();
  const homePhotos: HomePhotos = checkInData.photosDue
    ? { state: "due" }
    : photoCount > 0 && checkInData.photoSlots.every((p) => p.src) && photosSentRecently
    ? {
        state: "done",
        summary: `${photoCount}/${photoCount} · next sheet ${fmtShortDate(
          upcomingPhotoSheets(CLIENT_ID, localDateStr(), 1)[0]
        )}`,
      }
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
        <div className="tr-name">{deployedProgram?.name || "Your programme"}</div>
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

  const tabs: AppTab[] = [
    // Draws its own light banner (name and main goal); the top bar floats over it.
    { id: "home", label: "Home", icon: <HomeIcon />, bare: true, content: <HomeTab CLIENT_ID={CLIENT_ID} photos={homePhotos} /> },
    {
      id: "training",
      label: "Training",
      icon: <DumbbellIcon />,
      // Draws its own light banner; the top bar floats over it.
      bare: true,
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
      // Draws its own light banner; the top bar floats over it in navy.
      bare: true,
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
      coachMessages={{ coachName: getCoachDisplayName(CLIENT_ID), messages: coachMessagesFor(CLIENT_ID) }}
      helpEmail={getCoachEmail(CLIENT_ID)}
      coachProfile={getCoachProfileForClient(CLIENT_ID)}
      coachAvatarPath={getCoachAvatarPath(CLIENT_ID)}
      foodDiary={foodDiary}
    />
  );
}
