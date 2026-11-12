import { isEventTypeId } from "../lib/eventTypes";
import { warmClientPhotos } from "../lib/storage";
import { coachQuietHours } from "../lib/coachPush";
import { assistedRow } from "../lib/targetRule";
import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import { touchPresence } from "../lib/presence";
import { getData } from "../lib/db";
import {
  getAssignmentsForDay,
  getFreeSessions,
  isRogue,
  getClient,
  listClientEvents,
  carriedVideoReply,
  listEventCategories,
  getClientProfile,
  questionsForDay,
  sessionAnswers,
  listCardioForDay,
  chatThreadViews,
  isCardioDone,
  getLastMeetingRecap,
  getUpNextSession,
  listCalorieDays,
  getDeployedProgram,
  getClientExerciseNotes,
  listClientGyms,
  trainingDates,
  homeGymId,
  dayGymId,
  targetAtGym,
  getLogsForAssignment,
  getLastWarmupSets,
  gymSessionStats,
  gymDashboards,
  currentGymId,
  getClientCardPictures,
  effectiveAlternatives,
  exerciseGroup,
  getLastSets,
  getLastSetsByGym,
  getExerciseUnit,
  getLatestClientExerciseNotes,
  getExerciseHistory,
  liveSessionFor,
  listExercises,
  videoRequestsFor,
  resolveRecurringVideoAsks,
  listVideoReplies,
  getCurrentWeekNumber,
  getCheckInSections,
  getCheckInHistory,
  getCheckInStreak,
  getWorkoutCalendar,
  getActivityCalendar,
  getCheckInStatus,
  getClientPreferences,
  listPublishedWeekNumbers,
  getNotifications,
  notificationLink,
  describeMessageLink,
  getNutritionGoalsSummary,
  getFoodDiary,
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
  weeklyCheckInAskedToday,
  dropUnusedAutoWeight,
  monthlyCheckInAskedToday,
  getPhotoCadence,
  getPhotoInstructions,
  getPublishedWeek,
  listClients,
  meetingProvider,
  listMeetings,
  openMeetingRequest,
  listClientInvoices,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  photoSlotsOnSheet,
  photoSheetSlots,
  getPhotoSheetAngles,
  localDateStr,
  photoSheetFor,
  nextPhotoSheet,
  photoSheetForClient,
  getWeightGoalViews,
  askedWeightUnit,
  bodyWeightReadings,
  programWeekLabel,
  slugify,
  SUPPLEMENT_ITEMS,
  VITAMIN_ITEMS,
} from "../lib/queries";
import TrainingDayList from "./TrainingDayList";

import { type ProgressPicturesProps } from "./ProgressPicturesScreen";
import { setsDue } from "../lib/setsDue";
import LastWeekDays from "./LastWeekDays";
import HomeHub, { type LatestActivity, type UpcomingMeeting } from "./HomeHub";
import { FOCUS_NOTE, homeFocus } from "../lib/focus";
import type { HomeEvent, HomeEvents } from "./EventsCard";
import { VERDICT_TONE, VERDICT_WORD, goalItemId, kgIn } from "../lib/weightGoal";
import type { HomeWeight } from "./home/weightData";
import type { ClientMeetingView } from "./meetings/MeetingsScreen";
import { isMeetingTypeId } from "../lib/meetingTypes";
import type { ProgressPics } from "./ProgressPicsCard";
import FoodDiaryScreen, { type FoodDiaryProps } from "./FoodDiaryScreen";
import CoachCard from "./CoachCard";
import FitTitle from "./FitTitle";
import { Bars } from "./Bars";
import PhaseObjectives from "./PhaseObjectives";
import { FEATURES } from "../lib/features";
import PushToggle from "./PushToggle";
import { ConnectedApps } from "./HealthSync";
import { nativePushReady, pushPublicKey } from "../lib/push";
import SupplementsCard, { type SupplementRow } from "./SupplementsCard";
import NotificationsScreen, { type NotifView } from "./notifications/NotificationsScreen";
import { categorize, clockToZone, isListed, titleAndBody } from "../lib/notificationTypes";
import DeleteAccountRow from "./DeleteAccountRow";
import { clerkOn } from "../lib/clerk";
import MyDetailsCard from "./MyDetailsCard";
import GymSettings from "./GymSettings";
import SettingsFold from "./SettingsFold";
import ClientWeekSwitcher from "./ClientWeekSwitcher";
import AppShell, { AppTab, type Arrival, type PhoneScreen } from "./AppShell";
import NativeCoachRedirect from "../coach/NativeCoachRedirect";
import OpeningSplash from "./OpeningSplash";
import AvatarUpload from "./AvatarUpload";
import { phaseCovers, phaseLastDay } from "../lib/phases";
import { defaultPhaseCover } from "../lib/phaseCovers";
import { CardPicturesRows } from "./CardPictureSheet";
import { isGymColor } from "../lib/gymColors";
import { SERVER_TZ, hourIn, isTimezone, meetingLabelsIn, zonedToUtc } from "../lib/timezones";
import { cookies } from "next/headers";
import { dayWords, monthWords, weekdayWords } from "../lib/clientDates";
import type { HomePhase, PhaseFoodToday } from "./PhaseCards";
import {
  AppleIcon,
  DumbbellIcon,
  HomeIcon,
} from "../components/icons";
import PrefSwitch from "./PrefSwitch";
import { personalBests } from "../lib/homeBoardData";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

// A note with no kind set still needs a header — "Note" is the honest
// fallback rather than guessing which of the three it is.
// Dates through the one helper (3 Nov, Alex: docs/boards/dates-times-mockup.html).
function noteDateLabel(at: string | null): string {
  if (!at) return "";
  return dayWords(new Date(at));
}

// Which client the app is showing. There's no login yet, so the admin's
// "View client app" link carries ?client=<id> and this falls back to the
// first client on the books — that fallback is why building a program for
// one client and opening the app showed another's.
// Which client this app is showing is now decided ONLY by the signed session
// cookie. It used to come from ?client=<id>, which meant any logged-in person
// could read another client's entire app by editing the URL. A coach can
// still preview a specific client via ?client=, because requireClientAccess
// grants coaches access to anyone; for a client the parameter is ignored.
// PreviewBar's cookie (a client module's constant reads as a reference here, not the string).
const PREVIEW_COOKIE = "ironline_preview";
// The screens the phone preview can open on (AppShell's PhoneScreen), and which of them are tabs.
const PHONE_SCREENS = new Set<string>(["home", "training", "nutrition", "checkin", "photos", "messages", "meetings", "invoices", "events"]);
const PHONE_TAB_SCREENS = new Set<string>(["home", "training", "nutrition"]);

async function resolveClientId(raw: string | undefined): Promise<number | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/login/change-password");

  // A coach may preview their own clients' apps, so ?client= still works for
  // them, but only for a client of theirs.
  // Without one, the client they last switched to (PreviewBar's cookie),
  // else their first by name.
  if (user.role === "coach") {
    const mine = (id: number | null) => id != null && getClient(id)?.coach_id === user.id;
    const asked = raw ? Number(raw) : null;
    if (mine(asked)) return asked;
    const last = Number((await cookies()).get(PREVIEW_COOKIE)?.value) || null;
    return mine(last) ? last : listClients(user.id)[0]?.id ?? null;
  }

  // A client gets their own id and nothing else — the parameter is ignored.
  if (user.client_id == null) redirect("/login");
  return user.client_id;
}

const fmtShortDate = (iso: string) => dayWords(iso);

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
function meetingCardView(m: ReturnType<typeof listMeetings>[number], today: string, phoneTz: string | null = null): NonNullable<UpcomingMeeting> {
  const when = new Date(`${m.date}T00:00:00`);
  const days = Math.round((when.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  // The start as a real moment, from the timezone the coach typed the time
  // in (the server's, Amsterdam, for meetings from before it was asked): the
  // phone shows it in its own. "Starting now" from ten minutes before the
  // start until the end.
  const startAt = m.time ? zonedToUtc(m.date, m.time, m.tz || SERVER_TZ) : null;
  const nowMs = new Date().getTime();
  const startingNow = !!startAt && nowMs >= startAt.getTime() - 10 * 60000 && nowMs <= startAt.getTime() + m.duration_minutes * 60000;
  return {
    link: m.link ?? null,
    provider: meetingProvider(m.link),
    startingNow,
    startIso: startAt ? startAt.toISOString() : null,
    durationMinutes: m.duration_minutes,
    monthCap: monthWords(when, { short: true, year: false }),
    dayNumber: String(when.getDate()),
    weekdayCap: weekdayWords(when, { short: true }),
    topic: m.topic || "Check-in call",
    inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
    whenLabel: [
      weekdayWords(when),
      m.time || null,
    ]
      .filter(Boolean)
      .join(" ") + (m.all_day ? " · All day" : ` · ${m.duration_minutes} min`),
    // In the phone's timezone when its cookie says which, worded as the phone
    // words them, so nothing changes once the page is on screen.
    ...(phoneTz && startAt ? meetingLabelsIn(startAt.toISOString(), m.duration_minutes, phoneTz, nowMs) : {}),
  };
}

// A call for the Meetings screen (9 Oct): its kind, its start as a moment
// the phone reads in its own time, the recap the coach wrote for the client
// (never the coach's own prep or running notes), and the events made from it.
function clientMeetingView(m: ReturnType<typeof listMeetings>[number], events: ReturnType<typeof listClientEvents>): ClientMeetingView {
  const startAt = m.time ? zonedToUtc(m.date, m.time, m.tz || SERVER_TZ) : null;
  return {
    id: m.id,
    title: m.topic || "Check-in call",
    type: isMeetingTypeId(m.meeting_type) ? m.meeting_type : "checkin",
    startIso: startAt ? startAt.toISOString() : null,
    date: m.date,
    durationMin: m.duration_minutes,
    joinUrl: m.link ?? null,
    notes: (m.summary ?? "").trim() || null,
    linkedEvents: events.filter((e) => e.meeting_id === m.id).map((e) => ({ id: e.id, title: e.title, kind: e.kind })),
    missed: m.status === "no-show",
  };
}

/** The client's events (theirs and the coach's) with the coach's categories: Home's "Coming up" card and the Events screen. */
function homeEvents(clientId: number): HomeEvents {
  // The plan's phases on the same timeline as their start (9 Oct): one day,
  // "Strength block 2 starts", in the track's colour, the objectives behind
  // the chevron. Not a stretch: the phase itself is Home's to keep track of.
  // Phase goals off (23 Oct, Alex): no note, so the row has nothing more and doesn't open.
  const phases = listClientPhases(clientId)
    .filter((p) => !p.draft)
    .map((p) => ({ id: -p.id, kind: null, title: `${p.name} starts`, start: p.start_week, end: p.start_week, note: FEATURES.phaseGoals ? (p.objectives ?? []).join(String.fromCharCode(10)) : "", mine: false, phase: p.track }));
  // Weight goals on their date (2 Nov, Alex): one day, the beige target, its weight as the title; every weight in the
  // unit the client is asked in.
  const unit = askedWeightUnit(clientId);
  const coachFirst = getCoachFirstName(clientId);
  const w = (kg: number | null) => (kg == null ? null : kgIn(kg, unit));
  const goals: HomeEvent[] = getWeightGoalViews(clientId).map((g) => ({
    id: goalItemId(g.id),
    kind: null,
    title: `${kgIn(g.targetKg, unit)} ${unit}`,
    start: g.byDate,
    end: g.byDate,
    note: g.note,
    mine: g.addedBy === "client",
    goal: {
      id: g.id,
      unit,
      target: kgIn(g.targetKg, unit),
      byDate: g.byDate,
      start: kgIn(g.startKg, unit),
      startDate: g.startDate,
      nowKg: w(g.nowKg),
      planNow: w(g.planNowKg),
      mine: g.addedBy === "client",
      setBy: g.addedBy === "client" ? "you" : coachFirst,
      active: g.active,
      settled: g.settled,
      verdict: g.verdict,
      verdictWord: g.verdict ? VERDICT_WORD[g.verdict] : null,
      toGo: w(g.toGoKg),
      done: g.done,
      elapsed: g.elapsed,
      reachedOn: g.reachedOn,
      missedBy: w(g.missedByKg),
    },
  }));
  return {
    list: [...listClientEvents(clientId).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start_date, end: e.end_date, note: e.note, mine: e.added_by === "client", repeat: e.repeat ?? null })), ...phases, ...goals],
    categories: listEventCategories(getClient(clientId)?.coach_id ?? 0).map(({ id, label, color }) => ({ id, label, color })),
  };
}

/** Home's Weight (3 Nov, Alex): the readings and windows the row draws, as the coach's Weight card reads them; null with no
    weigh-in. */
function homeWeight(clientId: number, today: string): HomeWeight | null {
  const unit = askedWeightUnit(clientId);
  const readings = bodyWeightReadings(clientId).filter((r) => r.kg > 0 && r.date <= today);
  if (!readings.length) return null;
  const v = (kg: number) => Math.round(kgIn(kg, unit) * 10) / 10;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const goal = getWeightGoalViews(clientId, today).find((g) => g.active) ?? null;
  const phase = getCurrentPhase(clientId, "nutrition") ?? getCurrentPhase(clientId, "training") ?? getCurrentPhase(clientId, "lifestyle");
  const since = phase && phase.start_week <= today ? phase.start_week : null;
  const from7 = isoPlusDays(today, -6);
  const from30 = isoPlusDays(today, -29);
  const first = [from30, since, goal?.startDate].filter((d): d is string => !!d).sort()[0];
  const points = readings.filter((r) => r.date >= first).map((r) => ({ date: r.date, value: v(r.kg) }));
  const latest = readings[readings.length - 1];
  const now = v(latest.kg);
  /** The latest reading in the window against its first. */
  const rolling = (from: string) => {
    const inIt = points.filter((p) => p.date >= from);
    return { from, change: inIt.length >= 2 ? r1(inIt[inIt.length - 1].value - inIt[0].value) : null };
  };
  // Phase: against the reading nearest its first day, either side, within a month; else from its first reading in it.
  const phaseWindow = (() => {
    if (!since) return null;
    const startMs = Date.parse(`${since}T00:00:00`);
    const near = readings.reduce((b, r) => (Math.abs(Date.parse(`${r.date}T00:00:00`) - startMs) < Math.abs(Date.parse(`${b.date}T00:00:00`) - startMs) ? r : b));
    const ok = Math.abs(Date.parse(`${near.date}T00:00:00`) - startMs) <= 31 * 86400000 && near.date !== latest.date;
    return ok ? { from: since, change: r1(now - v(near.kg)) } : rolling(since);
  })();
  return {
    unit,
    now,
    points,
    windows: { "7d": rolling(from7), "30d": rolling(from30), phase: phaseWindow },
    goal: goal
      ? {
          start: v(goal.startKg),
          startDate: goal.startDate,
          target: v(goal.targetKg),
          byDate: goal.byDate,
          toGo: goal.toGoKg == null ? null : v(goal.toGoKg),
          verdictWord: goal.verdict ? VERDICT_WORD[goal.verdict] : null,
          tone: goal.verdict ? VERDICT_TONE[goal.verdict] : "",
        }
      : null,
  };
}

function isoPlusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function HomeTab({ CLIENT_ID, photos, food, phoneTz }: { CLIENT_ID: number; photos: ProgressPics; food: PhaseFoodToday; phoneTz: string | null }) {
  const client = getClient(CLIENT_ID);
  const today = localDateStr();

  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const upcoming: UpcomingMeeting = upcomingMeeting ? meetingCardView(upcomingMeeting, today, phoneTz) : null;

  // ---- The check-in, counted the way its screen shows it (today's, plus
  // the week's on its day or while still owed), for the lifestyle card. ----
  // No Weight seeded for a client with no check-in lines (17 Oct, Alex): a new client starts with nothing; the coach adds what they want asked.
  // One the app added before that, untouched and invisible to the coach, goes.
  dropUnusedAutoWeight(CLIENT_ID);
  const sections = getCheckInSections(CLIENT_ID);
  const weeklyOpen = weeklyCheckInAskedToday(CLIENT_ID, sections.sections);
  const monthlyOpen = monthlyCheckInAskedToday(CLIENT_ID, sections.sections);
  const onScreen = sections.sections.filter((s) => s.id === "daily" || (s.id === "monthly" ? monthlyOpen : weeklyOpen)).flatMap((s) => s.metrics);
  const checkInCount = { done: onScreen.filter((m) => m.value !== "").length, total: onScreen.length };

  const dateLabel = dayWords(today, { weekday: "long", long: true });

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
      const done = days.some(({ day, assignments }) => !!day.session_ended_at || assignments.every((a) => getLogsForAssignment(a.id).length >= setsDue(a)));
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
    return { nextWeekLabel: dayWords(next, { weekday: "short" }) };
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
        // No end (26 Oct): the card says the week it is in, no countdown.
        end: ph.open_ended ? null : phaseLastDay(ph.end_week),
        coverUrl: ph.cover_path ?? defaultPhaseCover(track, ph.id),
        coachCover: !!ph.cover_path,
        objectives: FEATURES.phaseGoals ? ph.objectives ?? [] : [],
        note: ph.nutrition?.coach_notes?.trim() || null,
        // The scheduled phase after this one on the track (9 Oct): the card names it, and charges up in its last week.
        next: (() => {
          const n = listClientPhases(CLIENT_ID).find((p) => p.track === track && !p.draft && p.id !== ph.id && p.start_week > ph.start_week && p.start_week > today);
          return n ? { name: n.name, start: n.start_week } : null;
        })(),
      },
    ];
  });
  return (
    <HomeHub
      clientId={CLIENT_ID}
      meetingRequest={openMeetingRequest(CLIENT_ID)}
      cardCovers={getClientCardPictures(CLIENT_ID)}
      dateLabel={dateLabel}
      firstName={(client?.name ?? "").trim().split(/\s+/)[0] || "there"}
      coach={{ firstName: coachFirst, photoPath: getCoachAvatarPath(CLIENT_ID) }}
      session={session}
      progressPics={photos}
      latestActivity={latestCoachActivity(CLIENT_ID, coachFirst, phoneTz)}
      upcoming={upcoming}
      recap={getLastMeetingRecap(CLIENT_ID)}
      phases={phases}
      hello={phoneTz ? (hourIn(phoneTz) < 12 ? "Good morning" : hourIn(phoneTz) < 18 ? "Good afternoon" : "Good evening") : "Hello"}
      checkInCount={onScreen.length ? checkInCount : null}
      weekDone={weekDone}
      trainedToday={trainedToday}
      today={today}
      food={food}
      // With no phase live, what is next (the empty phase cards name it).
      planGap={(() => {
        if (phases.some((p) => p.track !== "lifestyle")) return null;
        const next = listClientPhases(CLIENT_ID)
          .filter((p) => !p.draft && p.track !== "lifestyle" && p.start_week > today)
          .sort((a, b) => a.start_week.localeCompare(b.start_week))[0];
        return { next: next ? { track: next.track, name: next.name, start: next.start_week } : null };
      })()}
      events={homeEvents(CLIENT_ID)}
      checkInForm={{ date: today, sections: sections.sections, weeklyOpen, monthlyOpen }}
      // To focus on (23 Oct, Alex; lib/focus.ts): the coach's goals until the next call, at the top of Home.
      focus={homeFocus(CLIENT_ID, today, phoneTz)}
      // The weight row (3 Nov, Alex): always, with Goal | 7d | 30d | Phase.
      weight={homeWeight(CLIENT_ID, today)}
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
const COMMENT_ON = { nutrition: "your nutrition", checkin: "your check-in", photos: "your shape update", training: "your training" } as const;

function latestCoachActivity(clientId: number, coachFirst: string, phoneTz: string | null = null): LatestActivity {
  const weekAgo = Date.now() - 7 * 86400000;
  const sent = coachMessagesFor(clientId).filter((m) => !m.mine && (m.text.trim() || m.media));
  const latestMsg = sent[sent.length - 1] ?? null;
  // A coach chat message's own notification ("Your coach sent you a video")
  // is only its echo: read the message itself (17 Oct), so a form review shows
  // as the reply it is rather than a bare "Sent you a note".
  // A time in the coach's zone read in the client's own (12 Nov, Alex).
  const notes = getNotifications(clientId).filter(isListed).map((n) => ({ ...n, message: clockToZone(n.message, phoneTz) }));
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
    // A form review lands in the chat too, pointing at the exercise: show it
    // as the reply, which View plays in the pop-up (17 Oct).
    const media = latestMsg.media;
    const reply = media?.type === "video" ? listVideoReplies(clientId).find((r) => r.replySrc === media.path) ?? null : null;
    if (reply) return { kind: "video", title: `Replied to your video of ${reply.exerciseName}`, body: reply.replyNote || null, whenLabel: relativeLabel(iso), cta: "Watch", videoReply: reply, unread, unseen: !reply.seen, moreThisWeek };
    if (latestMsg.link && !latestMsg.link.gone) {
      const k = latestMsg.link.link.kind;
      const context = k === "food" || k === "nutrition" ? "nutrition" : k === "checkin" ? "checkin" : k === "photos" ? "photos" : "training";
      const cta = context === "nutrition" ? "View meal" : context === "checkin" ? "View check-in" : context === "photos" ? "View shape update" : "View session";
      return { kind: "comment", context, title: `Commented on ${COMMENT_ON[context]}`, body: latestMsg.text || null, whenLabel: relativeLabel(iso), cta, link: latestMsg.link, unread, unseen: unread > 0, moreThisWeek };
    }
    return { kind: "message", title: "Sent you a message", body: latestMsg.text || (media ? (media.type === "video" ? "Sent you a video" : media.type === "image" ? "Sent you a photo" : media.type === "audio" ? "Sent you a voice message" : "Sent you a file") : null), whenLabel: relativeLabel(iso), cta: "Reply", link: latestMsg.link, unread, unseen: unread > 0, moreThisWeek };
  }
  if (latestNote) {
    const when = relativeLabel(latestNote.created_at);
    const base = { whenLabel: when, notificationId: latestNote.id, actionTab: latestNote.action_tab, actionRef: latestNote.action_ref, unread, unseen: !latestNote.read, moreThisWeek };
    if (latestNote.action_tab === "video") {
      const reply = listVideoReplies(clientId).find((r) => r.id === latestNote.action_ref) ?? null;
      return { kind: "video", title: reply ? `Replied to your video of ${reply.exerciseName}` : "Replied to your video", body: reply?.replyNote || null, cta: "Watch", videoReply: reply, ...base };
    }
    // The button says where it goes, after what changed: View training,
    // View nutrition, View check-in (a lifestyle phase), and so on. A
    // training change carries its words after the colon ("Added Squat to
    // Lower (week 5)"): they go under the title, and View opens that
    // session (the note's ref is the day; its week picks the week strip).
    const title = actionOnly(latestNote.message);
    const colon = latestNote.message.indexOf(": ");
    const detail = colon > 0 ? latestNote.message.slice(colon + 2).replace(/ · /g, ". ") : null;
    // What a training note opens: its session or exercise (notificationLink reads which from its key, 24 Oct), never a day
    // looked up by a ref alone, which a programme's or a phase's id can match.
    const noteLink = notificationLink(clientId, latestNote);
    const focusWeek = noteLink?.week ?? null;
    if (latestNote.kind === "programme") {
      if (latestNote.action_tab === "nutrition") return { kind: "deploy", track: "nutrition", title, body: null, cta: "View nutrition", ...base };
      if (latestNote.action_tab === "home") return { kind: "comment", context: "checkin", title, body: null, cta: "View check-in", ...base };
      return { kind: "deploy", track: "training", title, body: null, cta: "View training", ...base, actionTab: latestNote.action_tab ?? "training" };
    }
    if (latestNote.action_tab === "nutrition") return { kind: "deploy", track: "nutrition", title, body: detail, cta: "View nutrition", ...base };
    if (latestNote.action_tab === "invoices") return { kind: "invoice", title, body: null, cta: "View invoices", ...base };
    // The coach set what to focus on (23 Oct): View opens Home at its top, where the list is (the goals' words could read as a call or a goal below).
    if (latestNote.kind === "general" && latestNote.message.startsWith(FOCUS_NOTE)) return { kind: "focus", title, body: detail, cta: "View", ...base, actionTab: latestNote.action_tab ?? "home" };
    // A change the coach made: read what it was from its tab and its words.
    if (latestNote.kind === "general") {
      const lower = latestNote.message.toLowerCase();
      if (latestNote.action_tab === "training") return { kind: "deploy", track: "training", title, body: detail, cta: lower.includes("video") ? "View exercise" : "View training", ...base, focusWeek, link: noteLink && !noteLink.gone ? noteLink : null };
      // A weight goal (2 Nov): to its row on Events, as its notification lands.
      if (/^(Set a weight goal|Changed your weight goal)/.test(latestNote.message)) return { kind: "weightGoal", title, body: detail, cta: "See it", ...base, actionRef: latestNote.action_ref ?? null };
      if (lower.includes("goal")) return { kind: "goal", title, body: detail, cta: "Open chat", ...base };
      if (lower.includes("call") || lower.includes("meeting")) return { kind: "meeting", title, body: detail, cta: "View meeting", ...base };
      // "progress pictures" is the feature's old name (21 Oct), still in notes written before.
      if (lower.includes("shape update") || lower.includes("progress pictures")) return { kind: "comment", context: "photos", title, body: detail, cta: "View shape update", ...base, actionTab: latestNote.action_tab ?? "home" };
      if (lower.includes("check in") || lower.includes("check-in")) return { kind: "comment", context: "checkin", title, body: detail, cta: "View check-in", ...base, actionTab: latestNote.action_tab ?? "home" };
      if (lower.includes("calendar")) return { kind: "message", title, body: detail, cta: "Open chat", ...base };
      return { kind: "message", title, body: detail, cta: latestNote.action_label ?? "Open", ...base };
    }
    if (latestNote.action_tab === "chat") return { kind: "message", title: "Sent you a message", body: latestNote.message, cta: "Reply", ...base };
    return { kind: "message", title: latestNote.action_label ?? "Sent you a note", body: latestNote.message, cta: latestNote.action_tab ? "Open" : "Open chat", ...base };
  }
  // Nothing from the coach and no phase ever (8 Oct): say so, and offer the chat.
  // A plan is set up once a phase has started (22 Oct): a draft or one still to come is not, as the client's tabs say.
  // A new client hears nothing more than that: no sentence explaining what will land here.
  const startedBy = localDateStr();
  if (!listClientPhases(clientId).some((p) => !p.draft && p.start_week <= startedBy)) {
    return { kind: "message", title: `Nothing from ${coachFirst} yet`, body: null, whenLabel: "", cta: "", unread: 0, unseen: false, moreThisWeek: 0 };
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
// The thread as the Messages screen shows it: chatThreadViews in lib/queries.ts.
const coachMessagesFor = chatThreadViews;

/** Behind a track's banner (14 Oct): the client's own card pictures, taking
    turns; else the coach's phase cover, when they chose one; else nothing,
    and the banner keeps its own photo. */
function bannerPictures(clientId: number, track: "training" | "nutrition" | "lifestyle"): string[] {
  const own = getClientCardPictures(clientId)[track];
  if (own?.length) return own;
  const cover = getCurrentPhase(clientId, track)?.cover_path;
  return cover ? [cover] : [];
}

function TrainingTab({ CLIENT_ID, week, currentWeek, showMyNotes }: { CLIENT_ID: number; week: number; currentWeek: number; showMyNotes: boolean }) {
  const days = getWeekDays(CLIENT_ID, week);
  // The client's note about the whole programme sits between the week's
  // figures and its sessions, outside any day.
  const program = getDeployedProgram(CLIENT_ID);
  const trainingDays = days.filter((d) => d.assignments.length > 0 || listCardioForDay(d.day.id).length > 0);
  // The client's own free sessions this week (19 Oct), after the plan's: drawn like them, counted in none of the figures above.
  const freeDays = getFreeSessions(CLIENT_ID, week)
    // A duplicate shows from when it is made, this week; a rogue session from when it starts.
    .filter((day) => !!day.session_started_at || (day.copy_of != null && week === getCurrentWeekNumber(CLIENT_ID) && trainingDays.some((t) => t.day.id === day.copy_of)))
    .map((day) => ({ day, assignments: getAssignmentsForDay(day.id) }));
  const stats = weekStats(CLIENT_ID, week);
  const dayTarget = stats.totalDays || 7;
  // Sessions finished this week: every set logged and any cardio ticked, the
  // rule the coach's Complete uses. One ended with sets missing is
  // unfinished: not counted as done, and not still "left" either.
  const complete = ({ day, assignments }: (typeof trainingDays)[number]) =>
    assignments.every((a) => getLogsForAssignment(a.id).length >= setsDue(a)) && listCardioForDay(day.id).every((c) => isCardioDone(c.id));
  const sessionsDone = trainingDays.filter(complete).length;
  const unfinished = trainingDays.filter((d) => !!d.day.session_ended_at && !complete(d)).length;
  const pct = Math.round((Math.min(sessionsDone, dayTarget) / dayTarget) * 100);
  // A session skipped with a reason is settled: it is not still "left" to
  // do. It does not count as trained either, so the ring stays honest.
  const skipped = trainingDays.filter(({ day, assignments }) => !!day.skip_reason && !assignments.some((a) => getLogsForAssignment(a.id).length > 0)).length;
  const sessionsLeft = dayTarget - sessionsDone - unfinished - skipped;
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
                {/* No "N sessions left" (17 Oct, Alex): the figure and the ring say it. Only a complete week or an unfinished session gets a line. */}
                {(() => {
                  const line = [sessionsLeft <= 0 && !unfinished ? "Week complete" : null, unfinished ? `${unfinished} unfinished` : null].filter(Boolean);
                  return line.length > 0 ? <div className={`tr-days-status${sessionsLeft <= 0 && !unfinished ? " done" : ""}`}><Bars parts={line} /></div> : null;
                })()}
              </div>
              {/* Green once the week is complete, like a finished session's pill. */}
              <div className={`tr-ring${sessionsLeft <= 0 ? " done" : ""}`} role="img" aria-label={`${pct}% of this week's sessions done`}>
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle cx="48" cy="48" r={ringR} fill="none" stroke={sessionsLeft <= 0 ? "#E8F5E9" : "#E0F2F1"} strokeWidth="5" />
                  <circle
                    className="tr-ring-fill"
                    cx="48"
                    cy="48"
                    r={ringR}
                    fill="none"
                    stroke={sessionsLeft <= 0 ? "#2E7D32" : "#00897B"}
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
          {/* No "Tell {coach} how the programme feels" (23 Oct, Alex): the client writes to the coach in the chat. */}
        </section>
      )}

      {/* The coach's objectives for the training phase, as on its Home card,
          and their note on it. */}
      <PhaseObjectives coachName={getCoachFirstName(CLIENT_ID)} objectives={FEATURES.phaseGoals ? getCurrentPhase(CLIENT_ID, "training")?.objectives ?? [] : []} />
      {(() => {
        const ph = getCurrentPhase(CLIENT_ID, "training");
        return (
          <CoachCard
            flat
            coachName={getCoachFirstName(CLIENT_ID)}
            photoPath={getCoachAvatarPath(CLIENT_ID)}
            note={ph?.client_note?.trim() || null}
            noteDate={ph?.client_note_at ? dayWords(new Date(ph.client_note_at)) : null}
          />
        );
      })()}

      {days.length === 0 || trainingDays.length === 0 ? null : (
        (() => {
          // "My notes" are private to the client: a coach previewing the app
          // gets empty ones.
          const myNotes = showMyNotes ? getClientExerciseNotes(CLIENT_ID) : new Map<number, string>();
          // Where the home gym has no note, the latest one from any gym.
          const latestNotes = showMyNotes ? getLatestClientExerciseNotes(CLIENT_ID) : new Map<number, string>();
          // Gyms: each exercise carries its target and note at every gym, so
          // switching gym in the session changes them without a round trip.
          const gyms = listClientGyms(CLIENT_ID);
          const allGyms = listClientGyms(CLIENT_ID, true);
          // The picker's rows (13 Oct): colour, type, sessions there and the last visit.
          const gymStats = gymSessionStats(CLIENT_ID);
          const lastGymId = currentGymId(CLIENT_ID);
          const home = homeGymId(CLIENT_ID);
          const notesByGym = new Map(
            allGyms.map((g) => [g.id, showMyNotes ? getClientExerciseNotes(CLIENT_ID, g.id) : new Map<number, string>()] as const)
          );
          const coachId = getClient(CLIENT_ID)?.coach_id ?? null;
          const library = new Map(coachId != null ? listExercises(coachId).map((e) => [e.id, e] as const) : []);
          const libraryName = new Map([...library].map(([id, e]) => [id, e.name] as const));
          const videoReplies = listVideoReplies(CLIENT_ID);
          // Each exercise's personal bests, as the coach's rows mark them (13 Nov, Alex: the marks on a finished session).
          let bests: ReturnType<typeof personalBests> = new Map();
          try {
            bests = personalBests(CLIENT_ID);
          } catch {
            /* none shown */
          }
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
              coachPhoto={getCoachAvatarPath(CLIENT_ID)}
              clientName={(getClient(CLIENT_ID)?.name ?? "").trim().split(/\s+/)[0] ?? ""}
              liveSession={liveSessionFor(CLIENT_ID)}
              headerPicture={bannerPictures(CLIENT_ID, "training")[0] ?? null}
              clientId={CLIENT_ID}
              library={[...library.values()].map((e) => ({ id: e.id, name: e.name, group: exerciseGroup(e) }))}
              days={[...trainingDays, ...freeDays].map(({ day, assignments }, i) => {
                const rogue = isRogue(day);
                const gymId = dayGymId(day.id);
                // Videos the coach asked for in this session.
                // Ask every session (15 Oct): requests this session inherits from recurring ones are made here, as the app loads it.
                resolveRecurringVideoAsks(day, assignments);
                const videoAsks = videoRequestsFor(assignments.map((a) => a.id));
                // A removed gym still shows on a session that was trained there.
                const dayGym = allGyms.find((g) => g.id === gymId);
                const dayGyms = dayGym?.archived ? [...gyms, dayGym] : gyms;
                return {
                key: day.id,
                index: i + 1,
                free: rogue,
                copy: day.copy_of != null,
                week: week - (program?.start_week ?? 1) + 1,
                // A free session has no gym (19 Oct, Alex): it is not tied to a place, and its sets carry none.
                gyms: dayGyms.map((g) => ({ id: g.id, name: g.name, color: isGymColor(g.color) ? g.color : "navy", kind: g.kind ?? "gym", sessions: gymStats.get(g.id)?.sessions ?? 0, lastUsedAt: gymStats.get(g.id)?.lastUsedAt ?? null, lastUsed: g.id === lastGymId, logo: g.logo_path ?? null, ...(g.once ? { once: true } : {}) })),
                gymId: rogue && day.gym_id == null ? null : gymId,
                // The coach's own name for the session. Without one it is
                // numbered by its place in the week; the weekday is never
                // shown here, so a session skipped to another day still
                // reads correctly.
                title: rogue ? "Rogue session" : day.label || `Session ${i + 1}`,
                skipReason: day.skip_reason ?? "",
                startedAt: day.session_started_at ?? null,
                endedAt: day.session_ended_at ?? null,
                sessionNote: day.session_note ?? "",
                questions: questionsForDay(day),
                answers: Object.fromEntries(sessionAnswers(day).flatMap((a): [string, number | string][] => (a.text != null ? [[a.id, a.text]] : a.value != null ? [[a.id, a.value]] : []))),
                cardio: listCardioForDay(day.id).map((c) => ({ id: c.id, name: c.name, time: c.time, pace: c.pace, incline: c.incline, distance: c.distance ?? "", notes: c.notes, done: isCardioDone(c.id), swap: c.swap?.name ?? null, alternatives: c.alternatives ?? [] })),
                exercises: assignments.map((a) => ({
                  id: a.id,
                  name: a.exercise_name ?? "Exercise",
                  swap: a.swap
                    ? { libraryExerciseId: a.swap.library_exercise_id, name: (a.swap.library_exercise_id != null ? libraryName.get(a.swap.library_exercise_id) : null) ?? a.swap.custom_name ?? "Another exercise" }
                    : null,
                  alternatives: effectiveAlternatives(a)
                    .filter((x) => library.has(x.exercise_id))
                    .map((x) => {
                      const e = library.get(x.exercise_id)!;
                      const variation = x.variation_id != null ? e.variations?.find((v) => v.id === x.variation_id) ?? null : null;
                      return { id: x.exercise_id, name: variation ? `${e.name} · ${variation.name}` : e.name, note: x.note, video: variation?.video_url ?? e.video_url };
                    }),
                  group: library.has(a.exercise_id) ? exerciseGroup(library.get(a.exercise_id)!) : "other",
                  sets: setsDue(a),
                  coachSets: a.sets,
                  reps: a.reps,
                  // Assisted by the library's exercise or variation, as the weight rule reads it, whatever the row is called.
                  assisted: assistedRow(library.get(a.exercise_id), a.variation_id),
                  targetWeight: rogue ? null : a.target_weight_kg,
                  unit: getExerciseUnit(a.id),
                  targetRpe: a.rpe_target,
                  tempo: a.tempo,
                  rest: a.rest_seconds ?? null,
                  distance: a.distance ?? null,
                  time: a.time ?? null,
                  // The coach's demo for this prescription wins; the exercise
                  // library's own video is the fallback.
                  // Swapped (17 Oct): the substitute's own demo from the library, or none; the original's would show the wrong exercise.
                  videoUrl: rogue ? null : a.swap ? (a.swap.library_exercise_id != null ? library.get(a.swap.library_exercise_id)?.video_url ?? null : null) : a.demo_hidden ? null : a.exercise_video_url ?? a.demo_url ?? null,
                  myNote: myNotes.get(a.exercise_id) || latestNotes.get(a.exercise_id) || "",
                  warmups: (a.warmup_sets ?? []).map((w) => ({ weight: w.weight_kg, reps: w.reps })),
                  lastWarmups: getLastWarmupSets(a.id).map((w) => ({ weight: w.weight_kg, reps: w.reps })),
                  pbSets: bests.get(a.id)?.sets ?? [],
                  videoRequest: (() => {
                    const r = videoAsks.get(a.id);
                    if (r) return { id: r.id, note: r.note, src: r.file_path, sentAt: r.submitted_at, reply: videoReplies.find((x) => x.id === r.id) ?? null, fromClient: !!r.from_client, media: r.media ?? "video", about: r.about ?? null, clientNote: r.client_note ?? null };
                    // The coach's reply from an earlier session of this exercise lands here too (9 Oct).
                    const c = carriedVideoReply(a.id);
                    const reply = c ? videoReplies.find((x) => x.id === c.id) ?? null : null;
                    return c && reply ? { id: c.id, note: null, src: null, sentAt: null, reply, carried: true } : null;
                  })(),
                  gymTargets: !rogue && allGyms.length ? Object.fromEntries(allGyms.map((g) => [g.id, targetAtGym(a, g.id, home)])) : undefined,
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
                  lastSetsAt: !rogue && allGyms.length > 1 ? getLastSetsByGym(a.id, allGyms.map((g) => g.id)) : undefined,
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

function NutritionTab({ CLIENT_ID, diary, readOnly = false }: { CLIENT_ID: number; diary: FoodDiaryProps; readOnly?: boolean }) {
  const summary = getNutritionGoalsSummary(CLIENT_ID);
  const plan = getNutritionPlan(CLIENT_ID);
  const storedPlan = getStoredNutritionPlan(CLIENT_ID);

  const today = localDateStr();
  // Sessions have no weekday: a day counts as a training day once a set was
  // logged on it (the last seven days below read their targets by it).
  const trainedOn = trainingDates(CLIENT_ID);
  const coachName = getCoachFirstName(CLIENT_ID);
  const short = (iso: string) => dayWords(iso);
  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return localDateStr(d);
  };
  const hasTargets = summary.trainingKcal > 0 || summary.restKcal > 0;

  // The nutrition phase the client is in, named as the coach named it on the Plan tab: the banner's title.
  const nutritionPhase = getCurrentPhase(CLIENT_ID, "nutrition");
  const pics = bannerPictures(CLIENT_ID, "nutrition");
  // Nutrition is the food diary (12 Nov, Alex: B of docs/boards/nutrition-is-the-diary-mockup.html, "one screen"): tap it
  // and you are in today's diary, logging. Nothing set up yet (no phase, no targets): the diary alone, its banner grey,
  // and none of what the coach sets (Supplements | Water, the note, Last 7 days).
  if (!nutritionPhase && !hasTargets) return <FoodDiaryScreen clientId={CLIENT_ID} diary={diary} pictures={pics} title="Your nutrition" naked readOnly={readOnly} />;

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
  const lastWeek = listCalorieDays(CLIENT_ID, 14)
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
        label: `${weekdayWords(d, { short: true })} ${d.getDate()}`,
        type: trained ? "Training" : "Rest",
        note: c.note ?? "",
        kcal,
        delta,
      };
    });


  const coachNote = plan.coach_notes?.trim() || null;
  // Today's water goal and supplements, between the ring and the meals, whichever day the diary shows (they are today's).
  const water = storedPlan.water_l != null && storedPlan.water_l > 0 ? storedPlan.water_l : null;
  const supps = supplements.length > 0 ? <SupplementsCard key="supps" date={today} rows={supplements} /> : null;
  const wsRow =
    water || supps ? (
      <div key="ws" className={`nd-wsrow${water && supps ? " both" : ""}`}>
        {water && (
          <div key="water" className="nd-water">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3.5c3.2 3.9 6 7.4 6 10.7a6 6 0 0 1-12 0c0-3.3 2.8-6.8 6-10.7z" />
            </svg>
            <span className="nd-water-title">Water</span>
            <span className="nd-water-goal">{water.toLocaleString("en-US", { maximumFractionDigits: 2 })} L</span>
          </div>
        )}
        {supps}
      </div>
    ) : null;

  return (
    <FoodDiaryScreen
      clientId={CLIENT_ID}
      diary={diary}
      pictures={pics}
      title={nutritionPhase?.name ?? "Your targets"}
      readOnly={readOnly}
      // Supplements | Water, then the coach's note over the meals (12 Nov, Alex: "the note from the coach has high
      // hierarchy level, have it before meals"). Keyed, as a list of the page's own parts.
      beforeMeals={[
        wsRow,
        coachNote ? (
          <CoachCard
            key="coach"
            coachName={coachName}
            photoPath={getCoachAvatarPath(CLIENT_ID)}
            note={coachNote}
            noteDate={nutritionPhase ? short(nutritionPhase.start_week) : null}
          />
        ) : null,
      ]}
      // Last 7 days at the foot; an empty list says nothing (10 Nov, Alex).
      foot={
        lastWeek.length === 0 ? undefined : (
          <div className="nd-body fdi-foot">
            <section className="nd-days">
              <div className="nd-section-head">
                <h2 className="nd-card-title">Last 7 days</h2>
              </div>
              <div className="nd-card">
                <LastWeekDays days={lastWeek} />
              </div>
            </section>
          </div>
        )
      }
    />
  );
}

function SettingsTab({ CLIENT_ID }: { CLIENT_ID: number }) {
  const client = getClient(CLIENT_ID);
  const coach = getCoachProfileForClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);
  const prefs = getClientPreferences(CLIENT_ID);

  // Weekly summary and the units toggle are out for now: the summary is
  // not built, and the units live on the Kg | Lbs switch in a session.
  // Push notifications, when this server has keys for them (lib/push.ts).
  const pushKey = pushPublicKey();
  // The title alone, no line under it (3 Nov, Alex: the words audit).
  const toggleDefs: { key: "coach_notes" | "checkin_reminders"; label: string }[] = [
    { key: "coach_notes", label: `Messages from ${getCoachFirstName(CLIENT_ID)}` },
    { key: "checkin_reminders", label: "Check-in reminders" },
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
      {/* Six rows, each opening (10 Nov, Alex), in order of use: yours (details, gyms, card pictures), then how the app
          behaves, what it connects to, your data. Log out is on the burger. */}
      <MyDetailsCard
        clientId={CLIENT_ID}
        email={profile.email ?? null}
        phone={profile.phone ?? null}
        phoneCode={profile.phone_code ?? null}
        address={{ address: profile.address ?? "", postcode: profile.postcode ?? "", city: profile.city ?? "", region: profile.region ?? "", country_code: profile.country_code ?? "", country: profile.country ?? "" }}
      />

      <GymSettings clientId={CLIENT_ID} gyms={gymDashboards(CLIENT_ID)} />

      {/* The pictures behind the Home cards (12 Oct): the client's own from their camera roll, or the coach's. Press and hold a card on Home does the same. */}
      <SettingsFold title="Card pictures">
        <div className="home-dark-rows">
          <CardPicturesRows
            clientId={CLIENT_ID}
            coachName={getCoachFirstName(CLIENT_ID)}
            rows={(["lifestyle", "training", "nutrition"] as const).map((track) => {
              const ph = getCurrentPhase(CLIENT_ID, track);
              const own = getClientCardPictures(CLIENT_ID)[track] ?? [];
              const coach = ph ? (ph.cover_path ?? defaultPhaseCover(track, ph.id)) : track === "lifestyle" ? "/img/lifestyle-bottle.jpg" : defaultPhaseCover(track, 0);
              // A stock cover the coach never chose is the default, not theirs (22 Oct).
              return { track, own, coach, coachChose: !!ph?.cover_path };
            })}
          />
        </div>
      </SettingsFold>

      <SettingsFold title="Preferences">
        <div className="home-dark-rows">
          <PushToggle publicKey={pushKey} nativeReady={nativePushReady()} />
          {toggleDefs.map((t) => (
            <PrefSwitch key={t.key} clientId={CLIENT_ID} prefKey={t.key} label={t.label} on={prefs[t.key]} />
          ))}
        </div>
      </SettingsFold>

      <ConnectedApps coachName={getCoachFirstName(CLIENT_ID)} />

      <SettingsFold title="Data">
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
          <DeleteAccountRow coachName={getCoachFirstName(CLIENT_ID)} passwordless={clerkOn()} />
        </div>
      </SettingsFold>
      </div>
    </div>
  );
}


// The Notifications screen (9 Oct): every row the coach caused, as a
// category with a title and a body, newest first; reminders and chat
// messages stay out (Home and the chat tab have them).
function NotificationsPanel({ CLIENT_ID, phoneTz = null }: { CLIENT_ID: number; phoneTz?: string | null }) {
  const coachFirst = getCoachFirstName(CLIENT_ID);
  const videoReplies = listVideoReplies(CLIENT_ID);
  // A call-notes notification from before 10 Oct carries no meeting: it is read as the latest call with a recap on or before its day.
  const recapped = listMeetings(CLIENT_ID)
    .filter((m) => (m.summary ?? "").trim())
    .sort((x, y) => (x.date < y.date ? 1 : -1));
  const meetingFor = (createdAt: string) => recapped.find((m) => m.date <= createdAt.slice(0, 10))?.id ?? null;
  // Likewise an event or a booked call from before: the event by its title in the message, the call by its topic, else the
  // call booked nearest after the note was written.
  const allEvents = listClientEvents(CLIENT_ID);
  const allMeetings = listMeetings(CLIENT_ID).filter((m) => m.status !== "cancelled");
  const eventFor = (message: string) => {
    const title = message.replace(/^Added to your calendar:s*/, "").trim();
    return [...allEvents].reverse().find((e) => e.title.trim() === title)?.id ?? null;
  };
  const bookedFor = (message: string, createdAt: string) => {
    const topic = /Scheduled a meeting[:s—–-]+[“"](.+)[”"]/.exec(message)?.[1]?.trim();
    const day = createdAt.slice(0, 10);
    const byTopic = topic ? [...allMeetings].sort((x, y) => (x.date < y.date ? 1 : -1)).find((m) => (m.topic ?? "").trim() === topic && m.date >= day) : null;
    if (byTopic) return byTopic.id;
    return [...allMeetings].filter((m) => m.date >= day).sort((x, y) => (x.date < y.date ? -1 : 1))[0]?.id ?? null;
  };
  const items: NotifView[] = getNotifications(CLIENT_ID, 300)
    .filter(isListed)
    .map((n) => {
      const { title, body } = titleAndBody(clockToZone(n.message, phoneTz), coachFirst);
      const category = categorize(n);
      const actionRef = n.action_ref ?? (category === "meeting_notes" ? meetingFor(n.created_at) : category === "event_added" ? eventFor(n.message) : category === "meeting_booked" ? bookedFor(n.message, n.created_at) : null);
      // An event's notification wears the event's own colour and icon (16 Oct), not the generic amber.
      const event = category === "event_added" || category === "event_changed" ? allEvents.find((e) => e.id === actionRef) ?? null : null;
      return {
        id: n.id,
        category,
        eventType: event && isEventTypeId(event.kind) ? event.kind : null,
        title,
        body,
        createdAt: n.created_at,
        read: n.read,
        actionTab: n.action_tab,
        actionRef,
        videoReply: n.action_tab === "video" ? videoReplies.find((r) => r.id === n.action_ref) ?? null : null,
        // The exact thing it is about, as a message link (24 Oct, Alex): a session, an exercise, the shape update.
        link: category === "pics_reviewed" ? describeMessageLink(CLIENT_ID, { kind: "photos" }) : notificationLink(CLIENT_ID, n),
      };
    });
  return <NotificationsScreen items={items} clientId={CLIENT_ID} coachName={coachFirst} />;
}

// ---- Progress pictures screen --------------------------------------------
// Everything the pushed Progress pictures screen shows, from the sheet
// schedule the coach set: the sheet open now with its angles, and every
// earlier sheet with the coach's notes on it.

// Shape update 1, 2, 3 in the order they opened (6 Nov, Alex: no "Month 1", no "sheet"), as the coach's tab counts them.
function sheetTitles(periods: string[]) {
  const order = [...new Set(periods)].sort();
  return (period: string) => `Shape update ${order.indexOf(period) + 1}`;
}

function progressPicturesData(CLIENT_ID: number): ProgressPicturesProps {
  // Their photos' small copies made behind the page where missing (27 Oct, Alex: Compare loading slowly).
  warmClientPhotos(CLIENT_ID);
  const today = localDateStr();
  const slots = listPhotoSlots(CLIENT_ID);
  const active = slots.filter((s) => !s.paused);
  const uploads = listPhotoUploads(slots.map((s) => s.id));
  const srcFor = (slotId: number, period: string) =>
    uploads.find((u) => u.slot_id === slotId && u.period === period)?.file_path ?? null;

  // The client's sheet: the open one, else the one just finished (a wrong photo can still be swapped) until the next opens.
  const openPeriod = active.length > 0 ? photoSheetForClient(CLIENT_ID, today) : null;
  const strictlyOpen = active.length > 0 ? photoSheetFor(CLIENT_ID, today) : null;
  const sent = listPhotoPeriods(slots.map((s) => s.id));
  const sheetTitle = sheetTitles(openPeriod ? [...sent, openPeriod] : sent);
  // The angles frozen on an update changed after it closed (12 Nov, Alex).
  const frozen = getPhotoSheetAngles(CLIENT_ID);
  const earlier = sent
    .filter((p) => p !== openPeriod)
    .map((period) => ({
      period,
      title: sheetTitle(period),
      // A sheet keeps any paused angle it already has a photo for, and an angle added later is not missing from it
      // (6 Nov, Alex; photoSlotsOnSheet). Each with the coach's word on how to take it, for a photo added late (12 Nov).
      photos: photoSlotsOnSheet(slots, uploads, period, false, frozen[period]).map((s) => ({
        slotId: s.id,
        label: s.label,
        src: srcFor(s.id, period),
        hint: s.hint ?? null,
      })),
    }));
  const oldest = earlier[earlier.length - 1];
  const next = active.length > 0 && !strictlyOpen ? nextPhotoSheet(CLIENT_ID, today) : null;

  return {
    clientId: CLIENT_ID,
    openSheet: openPeriod
      ? {
          period: openPeriod,
          title: sheetTitle(openPeriod),
          openedLabel: fmtShortDate(openPeriod),
          // The one just finished holds the angles it asked for, as every closed update (12 Nov), never one added since;
          // as Home's Today and the server read them (photoSheetSlots).
          slots: photoSheetSlots(CLIENT_ID, openPeriod, openPeriod === strictlyOpen).map((s) => ({
            id: s.id,
            label: s.label,
            hint: s.hint ?? null,
            src: srcFor(s.id, openPeriod),
            // A paused angle's photo never keeps the one just finished the client's (photoSheetForClient).
            ...(s.paused ? { paused: true } : {}),
          })),
          instructions: getPhotoInstructions(CLIENT_ID),
          // The one just finished, swappable until the next opens: closed, so never its last photo taken off (12 Nov).
          closed: openPeriod !== strictlyOpen,
        }
      : null,
    earlier,
    earlierSince: oldest ? monthWords(oldest.period, { year: false }) : null,
    nextLabel: next ? fmtShortDate(next) : null,
    hasAngles: slots.length > 0,
  };
}

export default async function ClientPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; open?: string; phone?: string; screen?: string; /** A push's notification (24 Oct). */ n?: string; /** A meeting reminder's call. */ meeting?: string }>;
}) {
  const params = await searchParams;
  const CLIENT_ID = await resolveClientId(params.client);
  // The coach's phone preview (21 Oct): ?phone=1 from the admin's panel draws this client's app read-only on the
  // screen it names (AppShell readOnly). A coach only; for a client the parameters are ignored.
  const phone = params.phone === "1" && (await getSessionUser())?.role === "coach";
  // The food diary is Nutrition now (12 Nov, Alex): an older admin asking for it gets Nutrition.
  const askedScreen = params.screen === "food" ? "nutrition" : params.screen;
  const phoneScreen = phone && PHONE_SCREENS.has(askedScreen ?? "") ? (askedScreen as PhoneScreen) : "home";
  // Who is in the app (9 Oct): this one, on the client app (a coach previewing counts as the coach). Not the preview:
  // the coach is on the admin, looking.
  if (!phone) touchPresence(await getSessionUser(), "Client app");
  // The phone's timezone and the tab it was on, from cookies AppShell sets:
  // the page is drawn as the phone will show it, so nothing jumps on load.
  const jar = await cookies();
  const tzCookie = decodeURIComponent(jar.get("ironline_tz")?.value ?? "");
  const phoneTz = tzCookie && isTimezone(tzCookie) ? tzCookie : null;
  const initialTab = phone ? (PHONE_TAB_SCREENS.has(phoneScreen) ? phoneScreen : "home") : jar.get("ironline_tab")?.value ?? null;
  // Only the client themselves sees their private "My notes", never a coach
  // previewing the app.
  const viewer = await getSessionUser();
  const viewerIsClient = viewer?.role === "client";
  // A coach sees whose app this is, and can switch to another of theirs.
  const preview =
    viewer?.role === "coach" && CLIENT_ID != null && !phone
      ? { current: { id: CLIENT_ID, name: getClient(CLIENT_ID)?.name ?? "" }, clients: listClients(viewer.id).map((c) => ({ id: c.id, name: c.name })) }
      : null;
  // A coach with no clients signed in to the client app (26 Oct, Alex: the client app on a phone that signed in with
  // the coach account): the switch screen, who this is and Sign out, not a dead end.
  if (CLIENT_ID == null && viewer?.role === "coach" && !phone) redirect("/login/switch?to=client");
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
    const period = photoSheetForClient(CLIENT_ID, localDateStr());
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
    dateLabel: dayWords(localDateStr(), { weekday: "long", long: true }),
    today: localDateStr(),
    pictures: bannerPictures(CLIENT_ID, "lifestyle"),
    sections: checkInData.sections,
    dueSections: checkInStatusForScreen.dueTypes as string[],
    weeklyOpen: weeklyCheckInAskedToday(CLIENT_ID, checkInData.sections),
    monthlyOpen: monthlyCheckInAskedToday(CLIENT_ID, checkInData.sections),
    objectives: FEATURES.phaseGoals ? getCurrentPhase(CLIENT_ID, "lifestyle")?.objectives ?? [] : [],
    // The coach's note on the lifestyle phase (21 Oct), dated as Training's is.
    coachNote: (() => {
      const ph = getCurrentPhase(CLIENT_ID, "lifestyle");
      const text = ph?.client_note?.trim();
      return text ? { text, date: ph?.client_note_at ? dayWords(new Date(ph.client_note_at)) : null } : null;
    })(),
    history: getCheckInHistory(CLIENT_ID),
    // The hub's streak and month, and everything done, day by day, for its calendar (28 Sep).
    stats: (() => {
      const month = localDateStr().slice(0, 7);
      const calendar = getWorkoutCalendar(CLIENT_ID);
      return {
        streak: getCheckInStreak(CLIENT_ID),
        workoutsThisMonth: calendar.filter((d) => d.date.startsWith(month)).reduce((n, d) => n + d.sessions.length, 0),
      };
    })(),
    calendar: getActivityCalendar(CLIENT_ID),
  };
  const progressPictures = progressPicturesData(CLIENT_ID);
  // The bell: anything unread but the chat, which has its own dot on the Messages tab (7 Oct).
  // Reminders and chat messages are not notifications (9 Oct): neither counts for the bell.
  const hasUnreadNotifications = getNotifications(CLIENT_ID).some((n) => isListed(n) && !n.read);

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
      trainingDays.every((d) => !!d.day.skip_reason || d.assignments.every((a) => getLogsForAssignment(a.id).length >= setsDue(a)))
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
        {/* No programme (22 Oct): bare, as the Nutrition and Lifestyle banners. */}
        <div className="tr-kicker">{deployedProgram ? "Programme" : "Training"}</div>
        <FitTitle className="tr-name">{deployedProgram ? deployedProgram.name || "Your programme" : "Your training"}</FitTitle>
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
              <span>Started {dayWords(start)}</span>
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

  // The Meetings screen (9 Oct): every call still to come, then the ones that
  // happened, each with the events made from it. Cancelled calls are left out.
  const meetings = (() => {
    const today = localDateStr();
    const all = listMeetings(CLIENT_ID).filter((m) => m.status !== "cancelled");
    const events = listClientEvents(CLIENT_ID);
    // A repeating call shows its next one alone (11 Nov, Alex: "it should only show the next one"); the one after comes
    // once that one is over or done.
    const seen = new Set<number>();
    const upcoming = all
      .filter((m) => m.status === "scheduled" && m.date >= today)
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
      .filter((m) => {
        if (m.series_id == null) return true;
        if (seen.has(m.series_id)) return false;
        seen.add(m.series_id);
        return true;
      })
      .map((m) => clientMeetingView(m, events));
    const past = all.filter((m) => m.status !== "scheduled" || m.date < today).map((m) => clientMeetingView(m, events));
    return { upcoming, past, request: openMeetingRequest(CLIENT_ID) };
  })();

  // The Invoices screen: what the coach has sent, to pay first. Absent until the first one arrives.
  const invoices = (() => {
    const today = localDateStr();
    const list = listClientInvoices(CLIENT_ID);
    // Always there (17 Oct, Alex): with none yet the menu still has Invoices, and the screen says there is nothing to pay.
    if (list.length === 0) return { invoices: [] };
    const short = (d: string) => dayWords(d);
    const rows = list.map((v) => {
      const when = new Date(`${v.issueDate}T12:00:00`);
      const late = v.status !== "paid" && (v.status === "due" || (!!v.dueDate && v.dueDate < today));
      return {
        id: v.id,
        number: v.number,
        dayNumber: String(when.getDate()),
        monthCap: monthWords(when, { short: true, year: false }),
        what: (v.lines[0]?.description ?? "Invoice") + (v.lines.length > 1 ? ` + ${v.lines.length - 1} more` : ""),
        total: new Intl.NumberFormat("en-GB", { style: "currency", currency: v.currency }).format(v.total),
        state: v.status === "paid" ? ("paid" as const) : late ? ("late" as const) : ("pay" as const),
        stateLabel: v.status === "paid" ? "Paid" : late ? (v.dueDate ? `Overdue since ${short(v.dueDate)}` : "Overdue") : v.dueDate ? `Due ${short(v.dueDate)}` : "To pay",
      };
    });
    return { invoices: rows };
  })();

  const tabs: AppTab[] = [
    // Draws its own light banner (name and main goal); the top bar floats over it.
    { id: "home", label: "Home", icon: <HomeIcon />, bare: true, content: <HomeTab CLIENT_ID={CLIENT_ID} phoneTz={phoneTz} photos={homePhotos} food={{ eaten: foodDiary.eaten.kcal, target: foodDiary.target?.kcal ?? null, mealsLogged: foodDiary.meals.filter((m) => m.entries.length > 0).length, mealsTotal: foodDiary.meals.length }} /> },
    {
      id: "training",
      label: "Training",
      icon: <DumbbellIcon />,
      // Draws its own light banner; the top bar floats over it.
      bare: true,
      darkBanner: true,
      content: (
        <div className={`tr${deployedProgram ? "" : " tr-naked"}`}>
          <ClientWeekSwitcher
            weeks={trainingWeeks}
            currentWeek={currentWeekNum}
            contents={trainingWeekContents}
            weekLabels={trainingWeekLabels}
            completedWeeks={completedWeeks}
            banner={trainingBanner}
            pictures={bannerPictures(CLIENT_ID, "training")}
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
      content: <NutritionTab CLIENT_ID={CLIENT_ID} diary={foodDiary} readOnly={phone} />,
    },
  ];

  return (
    <>
    {/* A coach in the native app goes to their phone screens (21 Oct, /coach). */}
    {viewer?.role === "coach" && !phone && <NativeCoachRedirect />}
    {/* The opening (7 Nov, Alex): the star spins away once the app is ready; never in the coach's phone preview. */}
    {!phone && <OpeningSplash />}
    <AppShell
      clientName={client?.name ?? ""}
      tabs={tabs}
      notificationsContent={<NotificationsPanel CLIENT_ID={CLIENT_ID} phoneTz={phoneTz} />}
      hasUnreadNotifications={hasUnreadNotifications}
      clientId={CLIENT_ID}
      preview={preview}
      checkIn={checkIn}
      photos={progressPictures}
      coachMessages={{
        coachName: getCoachDisplayName(CLIENT_ID),
        coachPhoto: getCoachAvatarPath(CLIENT_ID),
        myPhoto: client?.avatar_path ?? null,
        myName: client?.name ?? "You",
        messages: coachMessagesFor(CLIENT_ID),
        // The coach's quiet hours: the chat says they are away while they hold (27 Oct, Alex).
        quiet: coachQuietHours(CLIENT_ID),
        viewerIsClient,
        // How many of the coach's messages are new, so the chat opens on the first of them (25 Oct, Alex).
        unreadCount: getNotifications(CLIENT_ID).filter((n) => n.kind === "coach_note" && !n.read).length,
        events: { categories: listEventCategories(client?.coach_id ?? 0).map(({ id, label, color }) => ({ id, label, color })), today: localDateStr() },
      }}
      chatUnread={getNotifications(CLIENT_ID).some((n) => n.kind === "coach_note" && !n.read)}
      // Settings left the bottom nav for the burger (7 Oct): the chat has its tab.
      settingsContent={<SettingsTab CLIENT_ID={CLIENT_ID} />}
      events={homeEvents(CLIENT_ID)}
      helpEmail={getCoachEmail(CLIENT_ID)}
      coachProfile={getCoachProfileForClient(CLIENT_ID)}
      coachAvatarPath={getCoachAvatarPath(CLIENT_ID)}
      clientAvatarPath={client?.avatar_path ?? null}
      foodDiary={foodDiary}
      meetings={meetings}
      invoices={invoices}
      arrival={phone ? null : arrivalFrom(CLIENT_ID, params.n, params.meeting)}
      initialPush={phone ? (PHONE_TAB_SCREENS.has(phoneScreen) ? null : (phoneScreen as Exclude<PhoneScreen, "home" | "training" | "nutrition">)) : params.open === "invoices" ? "invoices" : params.open === "messages" ? "messages" : null}
      initialTab={initialTab}
      readOnly={phone}
    />
    </>
  );
}

/**
 * What a phone push asks the app to open (24 Oct, Alex: a push lands on its thing): its notification (?n=), worked out
 * as the notifications list does, or a meeting reminder's call (?meeting=). Null for anything else or another client's.
 */
function arrivalFrom(clientId: number, n: string | undefined, meeting: string | undefined): Arrival | null {
  if (meeting && Number.isInteger(Number(meeting))) return { meetingId: Number(meeting) };
  const id = Number(n);
  if (!n || !Number.isInteger(id)) return null;
  const note = getNotifications(clientId, 500).find((x) => x.id === id);
  if (!note) return null;
  const category = categorize(note);
  return {
    notificationId: note.id,
    category,
    actionTab: note.action_tab,
    actionRef: note.action_ref,
    link: category === "pics_reviewed" ? describeMessageLink(clientId, { kind: "photos" }) : notificationLink(clientId, note),
  };
}
