import { getData } from "../../lib/db";
import { getUserForClient, isOwner } from "../../lib/auth";
import { mailConfigured } from "../../lib/mail";
import { getCoachSettings, getInvoiceView, listInvoices, type InvoiceView } from "../../lib/queries";
import {
  clientAttention,
  getActivityFeed,
  getAssignmentsForDay,
  getClientProfile,
  getMetricEntries,
  getCoachProfile,
  getClientProgramNoteMeta,
  getDeployedProgram,
  getLoggedDays,
  getLoggedValues,
  getGoalSummaries,
  getMeetingsWorkspaceData,
  getLogsForAssignment,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getPlanData,
  listClientEvents,
  listEventCategories,
  getClientEngagement,
  getClientHome,
  getOverviewPanel,
  describeMessageLink,
  getClient,
  listChatMessages,
  listMessageLinkTargets,
  getPhotoCadence,
  getPhotoInstructions,
  getPhotoPeriodNote,
  getPhotoStartDate,
  getProgramCurrentWeekIndex,
  getStoredNutritionPlan,
  getWeek,
  getWeightSeriesAll,
  isCardioDone,
  listCardioForDay,
  listClientGyms,
  listCheckInNotes,
  listClientPhases,
  listClients,
  listLifestylePhases,
  listMetricsForPhase,
  listExercisesByGroup,
  listNutritionPhases,
  listPrograms,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  photoSheetFor,
  localDateStr,
  METRIC_GROUPS,
  METRIC_LIBRARY,
  metricGroup,
  MUSCLE_GROUPS,
  programWeekLabel,
  videoRequestsFor,
} from "../../lib/queries";
import { phaseCovers, phaseWeekIndex, phaseWeeks } from "../../lib/phases";
import type { DraftProgram, Library } from "./training/TrainingDraft";
import type { DraftNutrition } from "./nutrition/NutritionDraft";
import type { DraftMeasurements } from "./measurements/MeasurementsDraft";
import type { DraftPictures } from "./pictures/PicturesDraft";
import type { DraftGoal, DraftMeeting, DraftMeetings } from "./meetings/MeetingsDraft";
import type { DraftPlan } from "./plan/PlanDraft";
import type { DraftHome } from "./home/HomeDraft";
import type { DraftMessages } from "./messages/MessagesDraft";
import type { MessageLink } from "../../lib/messageLinks";

// What the redesign drafts read, gathered on the server for the shell that
// shows them side by side. Read-only: the drafts save nothing.

/** The client asked for, else the demo client, else one with a programme, else the first. */
export function pickClient(coachId: number, asked: string | undefined) {
  const clients = listClients(coachId);
  const id = Number(asked);
  const client = clients.find((c) => c.id === id) ?? clients.find((c) => c.name === "Demo Client") ?? clients.find((c) => getDeployedProgram(c.id)) ?? clients[0] ?? null;
  return { clients, client, firstName: client ? (client.name ?? "").split(" ")[0] || "the client" : "the client" };
}

// ---- Training -----------------------------------------------------------------

export function loadTraining(coachId: number, clientId: number, params: { week?: string; program?: string }): { draft: DraftProgram | null; library: Library } {
  // Every programme the client has had, is on, or has waiting: the switch in
  // the header. The one shown is the one asked for, else the live one.
  const live = getDeployedProgram(clientId);
  const all = listPrograms(clientId);
  const askedProgram = Number(params.program);
  const program = all.find((p) => p.id === askedProgram) ?? live ?? all[0] ?? null;
  const stateOf = (p: (typeof all)[number]) =>
    (p.id === live?.id ? "live" : p.status === "deployed" && live && p.start_week < live.start_week ? "past" : p.status === "deployed" || p.scheduled_at ? "scheduled" : "draft") as "live" | "past" | "scheduled" | "draft";
  const programs = all.map((p) => ({ id: p.id, name: p.name ?? "Programme", weeks: p.total_weeks, state: stateOf(p) }));

  const gymRows = listClientGyms(clientId);
  const gymName = new Map(gymRows.map((g) => [g.id, g.name] as const));
  const gyms = gymRows.map((g, i) => ({ id: g.id, name: g.name, home: i === 0 }));

  // The coach's library, for the add-exercise row; cardio has its own form.
  const byGroup = listExercisesByGroup(coachId);
  const libName = new Map(Object.values(byGroup).flat().map((e) => [e.id, e.name] as const));
  const library: Library = MUSCLE_GROUPS.filter((g) => g.slug !== "cardio" && (byGroup[g.slug]?.length ?? 0) > 0).map((g) => ({
    slug: g.slug,
    label: g.label,
    exercises: (byGroup[g.slug] ?? []).map((e) => ({ id: e.id, name: e.name })),
  }));

  if (!program) return { draft: null, library };

  const liveIdx = program.status === "deployed" ? getProgramCurrentWeekIndex(program) : 0;
  const askedWeek = Number(params.week);
  const weekIdx = Number.isInteger(askedWeek) && askedWeek >= 1 && askedWeek <= program.total_weeks ? askedWeek : Math.max(1, liveIdx);
  const weekNumber = program.start_week + weekIdx - 1;

  const weeks = Array.from({ length: program.total_weeks }, (_, i) => {
    const n = program.start_week + i;
    const days = getWeek(clientId, n);
    // One dot a session, every session: green once the client completed it
    // (every set logged, every cardio ticked), so the dots always count the
    // sessions listed under the week.
    const trained = days.map((d) => {
      const as = getAssignmentsForDay(d.id);
      const cs = listCardioForDay(d.id);
      if (as.length === 0 && cs.length === 0) return false;
      return as.every((a) => getLogsForAssignment(a.id).length >= a.sets) && cs.every((c) => isCardioDone(c.id));
    });
    return {
      index: i + 1,
      label: programWeekLabel(program, n),
      trained,
      state: (i + 1 < liveIdx ? "past" : i + 1 === liveIdx ? "live" : "ahead") as "past" | "live" | "ahead",
    };
  });

  const days = getWeek(clientId, weekNumber);
  // The chat about an exercise, both sides (the workout's chat button and the
  // coach's replies link a message to it), by assignment, oldest first.
  const aboutExercise = new Map<number, { mine: boolean; text: string; when: string }[]>();
  for (const m of [...listChatMessages(clientId)].sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    if (m.link?.kind !== "exercise") continue;
    const list = aboutExercise.get(m.link.assignmentId) ?? [];
    list.push({ mine: m.sender === "coach", text: m.text || "A file", when: new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
    aboutExercise.set(m.link.assignmentId, list);
  }
  const sessions = days.map((d, si) => {
    const assignments = getAssignmentsForDay(d.id);
    const videos = videoRequestsFor(assignments.map((a) => a.id));
    const rows = assignments.map((a) => {
      const logs = getLogsForAssignment(a.id).sort((x, y) => x.set_number - y.set_number);
      const v = videos.get(a.id);
      // Every week of the programme this exercise appears in, with what was
      // logged: the progress dialog, and the 7 / 30 day trends.
      const history = Array.from({ length: program.total_weeks }, (_, i) => {
        const wn = program.start_week + i;
        const wd = getWeek(clientId, wn).find((x) => x.day_of_week === d.day_of_week);
        const wa = wd ? getAssignmentsForDay(wd.id).find((x) => x.exercise_id === a.exercise_id) : undefined;
        // A week the client swapped it out: those sets were another exercise,
        // so they stay out of this one's history, trends and progress.
        if (!wa || wa.swap) return null;
        const wl = [...getLogsForAssignment(wa.id)].sort((p, q) => p.set_number - q.set_number);
        const kgs = wl.map((l) => l.weight_kg ?? 0);
        return {
          week: i + 1,
          label: programWeekLabel(program, wn),
          target: wa.target_weight_kg,
          /** The reps asked that week ("8-10"), for the on-target verdict. */
          targetReps: wa.reps ?? "",
          setsPlanned: wa.sets,
          sets: wl.map((l) => ({ n: l.set_number, kg: l.weight_kg, reps: l.reps, rpe: l.rpe_actual })),
          best: kgs.length ? Math.max(...kgs) : null,
          // The best set with its reps counted: estimated one-rep max (Epley,
          // weight × (1 + reps / 30)). What the % and the trend follow, so
          // 60 kg × 22 then 60.5 kg × 8 reads as a drop, not +0.4%.
          e1rm: wl.length ? Math.max(...wl.map((l) => (l.weight_kg ?? 0) * (1 + (l.reps ?? 0) / 30))) : null,
          gym: wl[0]?.gym_id != null ? gymName.get(wl[0].gym_id) ?? null : null,
          current: i + 1 === weekIdx,
        };
      }).filter((h): h is NonNullable<typeof h> => h != null);
      const logged = history.filter((h) => h.sets.length > 0);
      const thisWeek = history.find((h) => h.current) ?? null;
      // 7 days: this week's estimated one-rep max against last week's. 30 days:
      // against the earliest logged week within the last four.
      const pct = (from: (typeof history)[number] | null) =>
        thisWeek?.e1rm != null && from?.e1rm != null && from !== thisWeek && from.e1rm > 0 ? Math.round(((thisWeek.e1rm - from.e1rm) / from.e1rm) * 1000) / 10 : null;
      // Last week means the week before, logged: an older week is not "7 days"
      // (week 1 against week 6 read as +650%).
      const lastWeek = thisWeek ? logged.find((h) => h.week === thisWeek.week - 1) ?? null : null;
      const monthBack = thisWeek ? logged.filter((h) => h.week < thisWeek.week && h.week >= thisWeek.week - 4)[0] ?? null : null;
      return {
        id: a.id,
        exerciseId: a.exercise_id,
        name: a.exercise_name ?? "Exercise",
        sets: a.sets,
        reps: a.reps ?? "",
        kg: a.target_weight_kg,
        gymKg: gyms.map((g) => ({ gym: g.name, kg: a.gym_targets?.[g.id]?.kg ?? a.target_weight_kg })),
        rpe: a.rpe_target,
        tempo: a.tempo,
        rest: a.rest_seconds,
        note: a.notes,
        // Swapped: the sets belong to what they did instead (swapInfo), not to the prescription.
        logged: a.swap ? [] : logs.map((l) => ({ set: l.set_number, kg: l.weight_kg, reps: l.reps, rpe: l.rpe_actual, gym: l.gym_id != null ? gymName.get(l.gym_id) ?? null : null })),
        exerciseChat: aboutExercise.get(a.id) ?? [],
        swapInfo: a.swap
          ? {
              name: (a.swap.library_exercise_id != null ? libName.get(a.swap.library_exercise_id) ?? null : null) ?? a.swap.custom_name ?? "Another exercise",
              typed: a.swap.library_exercise_id == null,
              when: new Date(a.swap.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
              sets: logs.map((l) => ({ set: l.set_number, kg: l.weight_kg, reps: l.reps, rpe: l.rpe_actual, gym: l.gym_id != null ? gymName.get(l.gym_id) ?? null : null })),
            }
          : null,
        video: v ? { requestId: v.id, state: (v.replied_at ? "replied" : v.file_path ? "in" : "asked") as "asked" | "in" | "replied", note: v.note, reply: v.reply_note ?? null } : null,
        demo: a.exercise_video_url ? { url: a.exercise_video_url, source: "library" as const } : a.demo_url ? { url: a.demo_url, source: "row" as const } : null,
        history,
        swap: a.swap ? (a.swap.library_exercise_id != null ? libName.get(a.swap.library_exercise_id) ?? null : null) ?? a.swap.custom_name ?? null : null,
        alternatives: (a.alternatives ?? []).filter((x) => libName.has(x.exercise_id)).map((x) => ({ exerciseId: x.exercise_id, name: libName.get(x.exercise_id)!, note: x.note ?? "" })),
        d7: pct(lastWeek),
        d30: pct(monthBack),
      };
    });
    const cardio = listCardioForDay(d.id).map((c) => ({ id: c.id, name: c.name, time: c.time, pace: c.pace, incline: c.incline, distance: c.distance ?? "", notes: c.notes, done: isCardioDone(c.id) }));
    const setsPlanned = rows.reduce((t, r) => t + r.sets, 0);
    // A swapped exercise's sets still count as done for the session.
    const setsLogged = rows.reduce((t, r) => t + r.logged.length + (r.swapInfo?.sets.length ?? 0), 0);
    const gym = rows.flatMap((r) => [...r.logged, ...(r.swapInfo?.sets ?? [])]).find((l) => l.gym)?.gym ?? null;
    const duration = d.session_started_at && d.session_ended_at ? Math.max(0, Math.round((Date.parse(d.session_ended_at) - Date.parse(d.session_started_at)) / 60000)) : null;
    return { id: d.id, number: si + 1, name: d.label || `Session ${si + 1}`, rows, cardio, setsPlanned, setsLogged, gym, skip: d.skip_reason ?? null, duration, ended: d.session_ended_at ?? null, note: d.session_note ?? null };
  });

  const phase = getData().client_phases.find((p) => p.program_id === program.id) ?? null;
  const noteMeta = getClientProgramNoteMeta(clientId, program.id);
  const draft: DraftProgram = {
    id: program.id,
    programs,
    name: program.name ?? "Programme",
    status: stateOf(program),
    totalWeeks: program.total_weeks,
    startWeek: program.start_week,
    phaseId: phase?.id ?? null,
    goals: phase?.objectives ?? [],
    coachNote: phase?.client_note ?? "",
    startDate: phase?.start_week ?? null,
    endDate: phase?.end_week ?? null,
    weekIdx,
    liveIdx,
    weeks,
    sessions,
    gyms,
    note: noteMeta ? { text: noteMeta.text, when: new Date(noteMeta.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) } : null,
  };
  return { draft, library };
}

// ---- Nutrition ----------------------------------------------------------------

const EMPTY = { protein: null, carbs: null, fats: null };
const STATE = { draft: "draft", now: "live", next: "scheduled", past: "past" } as const;

// The coach's goals for a phase (up to three), shown on the client's Home.
const goalsOf = (phaseId: number | null | undefined): string[] => (phaseId ? getData().client_phases.find((p) => p.id === phaseId)?.objectives ?? [] : []);

export function loadNutrition(clientId: number, params: { phase?: string }): DraftNutrition {
  const today = localDateStr();
  const plan = getNutritionPlan(clientId);
  const stored = getStoredNutritionPlan(clientId);
  const derived = getNutritionGoalsSummary(clientId);
  const training = plan.day_targets?.training ?? { protein: derived.trainingProtein || null, carbs: derived.trainingCarbs || null, fats: derived.trainingFats || null };
  const rest = plan.day_targets?.rest ?? { protein: derived.restProtein || null, carbs: derived.restCarbs || null, fats: derived.restFats || null };

  // Every nutrition phase the client has had, is on, or has waiting: the
  // switch in the header. None at all: one client-level "Targets" sheet.
  const real = listNutritionPhases(clientId);
  const phases = real.length
    ? real.map((p) => ({
        id: p.id,
        name: p.name,
        state: STATE[p.status],
        start: p.start_week,
        end: p.end_week,
        weeks: phaseWeeks(p.start_week, p.end_week),
        training: p.nutrition?.day_targets.training ?? (p.status === "draft" ? EMPTY : stored.day_targets?.training ?? training),
        rest: p.nutrition?.day_targets.rest ?? (p.status === "draft" ? EMPTY : stored.day_targets?.rest ?? rest),
        note: p.nutrition?.coach_notes ?? (p.status === "draft" ? "" : stored.coach_notes ?? ""),
      }))
    : [{ id: 0, name: "Targets", state: "live" as const, start: null, end: null, weeks: 0, training, rest, note: plan.coach_notes ?? "" }];
  const askedPhase = Number(params.phase);
  const phase = phases.find((p) => p.id === askedPhase) ?? phases.find((p) => p.state === "live") ?? phases[0];

  const endOfWeek = (monday: string) => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return localDateStr(d);
  };
  // The days the client logged inside the phase on screen; with no phases,
  // the last four weeks.
  const fourWeeksBack = new Date(`${today}T00:00:00`);
  fourWeeksBack.setDate(fourWeeksBack.getDate() - 27);
  const from = phase.start ?? localDateStr(fourWeeksBack);
  const to = phase.end ? endOfWeek(phase.end) : today;
  const logged = getLoggedDays(clientId, from, to > today ? today : to);

  return {
    id: phase.id,
    goals: goalsOf(phase.id),
    phases: phases.map((p) => ({ id: p.id, name: p.name, weeks: p.weeks, state: p.state })),
    name: phase.name,
    status: phase.state,
    weeks: phase.weeks,
    weekIdx: phase.start && phase.end && phase.state === "live" ? phaseWeekIndex(phase.start, phase.end, today) : null,
    startDate: phase.start,
    endDate: phase.end,
    training: phase.training,
    rest: phase.rest,
    note: phase.note,
    waterL: stored.water_l ?? null,
    supplements: (stored.supplement_rows ?? []).map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, timing: r.timing, notes: r.notes })),
    logged,
  };
}

// ---- The rail ------------------------------------------------------------------

export type RailClient = { id: number; name: string; avatarPath: string | null; attention: string | null; notSignedIn: boolean };
export type RailData = { clients: RailClient[]; coach: { name: string; photoPath: string | null }; isOwner: boolean; inviteReady: boolean };

/** The left rail's data: every client with whether they need the coach, and the coach at the foot. */
export function loadRail(coach: { id: number; email: string; role: "coach" | "client" }): RailData {
  const feed = getActivityFeed(coach.id);
  const clients = listClients(coach.id).map((c) => {
    const user = getUserForClient(c.id);
    return { id: c.id, name: c.name, avatarPath: c.avatar_path ?? null, attention: clientAttention(c.id, feed), notSignedIn: !user || user.must_change_password };
  });
  const profile = getCoachProfile(coach.id);
  return { clients, coach: { name: profile?.display_name?.trim() || nameFromEmail(coach.email), photoPath: profile?.avatar_path ?? null }, isOwner: isOwner(coach), inviteReady: mailConfigured() };
}

// A coach account has an email but no name; "finlay.smith@…" reads as "Finlay Smith".
function nameFromEmail(email: string): string {
  const words = (email.split("@")[0] ?? "").split(/[._-]+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Coach";
}

// ---- Measurements ---------------------------------------------------------------

export function loadMeasurements(clientId: number, params: { phase?: string }): DraftMeasurements {
  const today = localDateStr();
  // The lifestyle phase being set up: the one asked for, else whatever is running.
  const real = listLifestylePhases(clientId);
  const askedPhase = Number(params.phase);
  const live = real.find((p) => p.status === "now") ?? null;
  const selected = real.find((p) => p.id === askedPhase) ?? live ?? real[0] ?? null;
  const isLive = !!selected && selected.status === "now";
  const phases = real.length
    ? real.map((p) => ({ id: p.id, name: p.name, weeks: phaseWeeks(p.start_week, p.end_week), state: STATE[p.status] }))
    : [{ id: 0, name: "Check-ins", weeks: 0, state: "live" as const }];
  const metrics = listMetricsForPhase(clientId, selected?.id ?? null, real.length === 0 || isLive).filter((m) => m.frequency !== "monthly");
  const existing = new Set(metrics.map((m) => m.name.toLowerCase()));

  // The library's packs, merged by label so the coach sees one group a theme.
  const library: DraftMeasurements["library"] = [];
  for (const p of METRIC_LIBRARY) {
    let pack = library.find((x) => x.label === p.label);
    if (!pack) library.push((pack = { id: p.id, label: p.label, group: p.group, items: [] }));
    for (const i of p.items) {
      if (pack.items.some((x) => x.name.toLowerCase() === i.name.toLowerCase())) continue;
      pack.items.push({ name: i.name, unit: i.unit, already: existing.has(i.name.toLowerCase()) });
    }
  }

  // A phase that has not started has nothing logged: a blank canvas. One that
  // has ended reads back from its end.
  const started = !selected || selected.status === "now" || selected.status === "past";
  let until: string | undefined;
  if (selected?.status === "past") {
    const end = new Date(`${selected.end_week}T00:00:00`);
    end.setDate(end.getDate() + 6);
    until = localDateStr(end);
  }
  // The table's columns are the metrics tracked now (the card above), with or
  // without phases: every definition the client ever had made repeated and
  // removed columns (three Weights, an old Resting HR).
  const scope = { metrics, until };
  const fmtWhen = (period: string) => {
    const days = Math.round((new Date(`${period}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === -1) return "yesterday";
    if (days > -7) return `${-days} days ago`;
    return new Date(`${period}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const startsOn = selected ? new Date(`${selected.start_week}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  return {
    id: selected?.id ?? 0,
    goals: goalsOf(selected?.id),
    phases,
    name: selected?.name ?? "Check-ins",
    status: selected ? STATE[selected.status] : "live",
    weeks: selected ? phaseWeeks(selected.start_week, selected.end_week) : 0,
    weekIdx: selected && selected.status === "now" ? phaseWeekIndex(selected.start_week, selected.end_week, today) : null,
    startDate: selected?.start_week ?? null,
    endDate: selected?.end_week ?? null,
    checkInDay: getClientProfile(clientId).check_in_day || null,
    groups: METRIC_GROUPS.map((g) => ({ key: g.key, label: g.label, tint: g.tint })),
    metrics: metrics.map((m) => {
      const g = metricGroup(m.category);
      const entries = getMetricEntries([m.id]).filter((e): e is typeof e & { value: number } => e.value != null).sort((a, b) => a.period.localeCompare(b.period));
      const last = entries[entries.length - 1];
      return { id: m.id, name: m.name, unit: m.unit, frequency: (m.frequency === "weekly" ? "weekly" : "daily") as "daily" | "weekly", groupKey: g.key, groupLabel: g.label, tint: g.tint, last: last ? { value: last.value, when: fmtWhen(last.period) } : null };
    }),
    library,
    daily: getLoggedValues(clientId, "daily", started ? 8 : 0, scope),
    weekly: getLoggedValues(clientId, "weekly", started ? 5 : 0, scope),
    dailyLong: getLoggedValues(clientId, "daily", started ? 30 : 0, scope),
    weeklyLong: getLoggedValues(clientId, "weekly", started ? 12 : 0, scope),
    notStarted: !started ? (selected?.status === "draft" ? "Nothing logged yet: this phase is a draft." : `Nothing logged yet: this phase starts ${startsOn}.`) : null,
    notes: (started ? listCheckInNotes(clientId, 12).filter((n) => !until || n.period <= until) : []).map((n) => ({ id: n.id, period: n.period, kind: n.kind, text: n.text })),
  };
}

// ---- Progress pictures ---------------------------------------------------------

const PERIOD_UNIT = { weekly: "Week", biweekly: "Check-in", monthly: "Month", sixweekly: "Block" } as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMonth = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const stampDay = (iso: string) => dayMonth(localDateStr(new Date(iso)));
const stampDayTime = (iso: string) => `${stampDay(iso)}, ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

export function loadPictures(clientId: number): DraftPictures {
  const cadence = getPhotoCadence(clientId);
  const startDate = getPhotoStartDate(clientId);
  const slots = listPhotoSlots(clientId);
  const active = slots.filter((s) => !s.paused);
  const slotIds = slots.map((s) => s.id);
  const uploads = listPhotoUploads(slotIds);
  const today = localDateStr();

  // The sheet open today, if any angle is being asked for and the first
  // sheet date has come; then every sheet anything was sent on, newest first.
  const live = active.length > 0 ? photoSheetFor(clientId, today) : null;
  const uploaded = listPhotoPeriods(slotIds);
  const periods = live && !uploaded.includes(live) ? [live, ...uploaded].sort((a, b) => (a < b ? 1 : -1)) : uploaded;
  const uploadFor = (slotId: number, period: string) => uploads.find((u) => u.slot_id === slotId && u.period === period) ?? null;

  // The weigh-in that fell inside a sheet: the last one from the day it
  // opened up to the day the next sheet opened (or today, for the newest).
  const weights = getWeightSeriesAll(clientId);
  const weightFor = (period: string, newer: string | undefined) => {
    const inside = weights.filter((w) => w.date >= period && (newer ? w.date < newer : w.date <= today));
    const last = inside[inside.length - 1];
    return last ? Math.round(last.value * 10) / 10 : null;
  };
  // The Plan tab's phase that covered the week a sheet opened in.
  const phases = listClientPhases(clientId).filter((p) => !p.draft);
  const phaseOn = (track: "nutrition" | "training", day: string) =>
    phases.find((p) => p.track === track && phaseCovers(p.start_week, p.end_week, day))?.name ?? null;

  const sheets = periods.map((period, i) => {
    const cells = slots
      .filter((s) => !s.paused || uploadFor(s.id, period))
      .map((s) => {
        const u = uploadFor(s.id, period);
        return { slotId: s.id, label: s.label, src: u?.file_path ?? null, shot: u ? stampDayTime(u.uploaded_at) : null, shotDay: u ? stampDay(u.uploaded_at) : null };
      });
    const inCount = cells.filter((c) => c.src).length;
    const number = periods.length - i;
    const note = getPhotoPeriodNote(clientId, period);
    return {
      period,
      title: `${PERIOD_UNIT[cadence]} ${number}`,
      live: period === live,
      complete: cells.length > 0 && inCount === cells.length,
      dateLabel: dayMonth(period),
      inCount,
      total: cells.length,
      cells,
      note: { shape: note.shape, strengths: note.strengths, improvements: note.improvements, next_steps: note.next_steps },
      savedLabel: note.saved_at ? stampDayTime(note.saved_at) : null,
      weight: weightFor(period, periods[i - 1]),
      phases: { nutrition: phaseOn("nutrition", period), training: phaseOn("training", period) },
    };
  });

  return {
    cadence,
    startDate,
    instructions: getPhotoInstructions(clientId) ?? "",
    slots: slots.map((s) => ({ id: s.id, label: s.label, paused: !!s.paused, count: uploads.filter((u) => u.slot_id === s.id).length })),
    sheets,
  };
}

// ---- Meetings ---------------------------------------------------------------------

export function loadMeetings(clientId: number): DraftMeetings {
  const today = localDateStr();
  const data = getMeetingsWorkspaceData(clientId);
  // Every goal, with its live standing in a few words.
  const goals: DraftGoal[] = getGoalSummaries(clientId).map(({ goal, view, tracking }) => {
    let status = "";
    if (view.kind === "metric") {
      const figure = (view.barLabel ?? "").split(" · ")[0];
      status = `${figure} · ${view.reached ? "reached" : (view.sub ?? "").includes("on pace") ? "on pace" : (view.sub ?? "").includes("behind") ? "behind" : "tracking"}`;
    } else if (view.kind === "exercise") status = (view.right ?? "").replace(/^best /, "");
    else if (view.kind === "habit") status = `${view.segments?.done ?? 0} of ${view.segments?.total ?? 0} · ${view.tone === "green" ? "on track" : "behind"}`;
    else status = goal.done ? "done" : "";
    return { id: goal.id, text: goal.text, tone: view.tone, status, def: tracking, done: goal.done, meetingId: goal.meeting_id ?? null };
  });
  const withGoals = (m: (typeof data.past)[number]): DraftMeeting => ({ ...m, goals: goals.filter((g) => g.meetingId === m.id) });
  return {
    today,
    upcoming: data.upcoming ? withGoals(data.upcoming) : null,
    alsoScheduled: data.alsoScheduled.map(withGoals),
    past: data.past.map(withGoals),
    goals: goals.filter((g) => !g.done),
    dots: data.dots,
    others: data.others,
    lastLink: data.lastLink,
  };
}

// ---- Plan ------------------------------------------------------------------------

/** How far through the week it is, 0 (Monday 00:00) to 1, in server-local time. */
const intoWeek = () => {
  const now = new Date();
  return (((now.getDay() + 6) % 7) + (now.getHours() + now.getMinutes() / 60) / 24) / 7;
};

export function loadPlan(clientId: number): DraftPlan {
  const d = getPlanData(clientId);
  return {
    today: d.today,
    thisWeek: d.thisWeek,
    intoWeek: intoWeek(),
    currentPhaseName: d.currentPhaseName,
    phases: d.phases,
    programs: d.programs,
    goals: d.goals,
    goalOptions: d.goalOptions,
    mainGoal: d.mainGoal,
    mainGoalSavedAt: d.mainGoalSavedAt ? new Date(d.mainGoalSavedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null,
    events: listClientEvents(clientId).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start_date, end: e.end_date, note: e.note })),
    eventCategories: listEventCategories(getData().clients.find((c) => c.id === clientId)?.coach_id ?? 0),
  };
}

// ---- Home ------------------------------------------------------------------------

export function loadHome(clientId: number): DraftHome {
  const panel = getOverviewPanel(clientId);
  const home = getClientHome(clientId);
  return {
    name: panel.name,
    initial: panel.initial,
    avatarPath: panel.avatarPath,
    clientSince: panel.clientSince,
    // "level this phase" under the weight said nothing; a real move still shows.
    snapshot: panel.snapshot.map((s) => (s.label === "Weight" && s.suffix?.startsWith("level") ? { ...s, suffix: undefined } : s)),
    panel,
    coachNote: panel.coachNote,
    actions: home.actions,
    events: home.events.map((e) => ({ id: e.id, category: e.category, text: e.text, note: e.note, when: e.when, tab: e.tab })),
    eventTotal: home.eventTotal,
    engagement: getClientEngagement(clientId),
  };
}

// ---- Messages --------------------------------------------------------------------

export function loadMessages(clientId: number): DraftMessages {
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  // Where a link in a message opens on the coach's side: the tab, and the
  // programme and week, or the day, it points at (the #part unfolds it there;
  // for an exercise, #session-DAY-ex-ROW scrolls to and marks the row).
  const programs = listPrograms(clientId);
  const hrefFor = (link: MessageLink, week: number | null): string => {
    const tab = (name: string, rest = "") => `/admin/redesign/${name}?client=${clientId}${rest}`;
    switch (link.kind) {
      case "session":
      case "exercise": {
        const p = week == null ? null : programs.find((x) => week >= x.start_week && week < x.start_week + x.total_weeks);
        const part = link.kind === "exercise" ? `#session-${link.dayId}-ex-${link.assignmentId}` : `#session-${link.dayId}`;
        return p ? tab("training", `&program=${p.id}&week=${week! - p.start_week + 1}${part}`) : tab("training");
      }
      case "food":
        return tab("nutrition", `#day-${link.date}`);
      case "nutrition":
        return tab("nutrition");
      case "checkin":
        return tab("measurements");
      case "photos":
        return tab("pictures");
    }
  };
  // Both sides, newest first: the client answers from their app.
  const messages = listChatMessages(clientId)
    .filter((m) => m.text.trim() || m.media_path)
    .reverse()
    .map((m) => {
      const view = m.link ? describeMessageLink(clientId, m.link) : null;
      return {
        id: m.id,
        mine: m.sender === "coach",
        text: m.text.trim(),
        when: when(m.created_at),
        media: m.media_path ? { path: m.media_path, type: m.media_type ?? "image", name: m.media_name ?? null } : null,
        link: view ? { area: view.area, label: view.label, gone: view.gone, href: view.gone ? undefined : hrefFor(m.link!, view.week) } : null,
        reactions: { coach: m.reactions?.coach ?? null, client: m.reactions?.client ?? null },
        pinned: !!m.pinned,
        edited: !!m.edited_at,
      };
    });
  return { messages, targets: listMessageLinkTargets(clientId), avatarPath: getClient(clientId)?.avatar_path ?? null };
}

// ---- Invoices tab: the client's invoices as they print, and what Settings
// gives a new one (numbering, VAT, terms), with what is still missing there.
export type DraftInvoices = {
  today: string;
  invoices: InvoiceView[];
  defaults: { currency: "EUR" | "USD" | "GBP"; vatRate: number; pricesIncludeVat: boolean; termsDays: number; nextNumber: string };
  missing: string[];
};

export function loadInvoices(coachId: number, clientId: number): DraftInvoices {
  const today = localDateStr();
  const s = getCoachSettings(coachId);
  const b = s.business ?? {};
  const i = s.invoicing ?? {};
  const next = Math.max(1, Math.round(i.next_number ?? 1));
  const invoices = listInvoices(clientId)
    .map((inv) => getInvoiceView(inv.id))
    .filter((v): v is InvoiceView => !!v)
    .sort((a, b2) => (a.issueDate === b2.issueDate ? b2.id - a.id : a.issueDate < b2.issueDate ? 1 : -1));
  const missing = [!b.business_name && "business name", !(b.address && b.city) && "address", !i.iban && "IBAN"].filter(Boolean) as string[];
  return {
    today,
    invoices,
    defaults: {
      currency: i.currency ?? "EUR",
      vatRate: i.vat_rate ?? 21,
      pricesIncludeVat: i.prices_include_vat ?? true,
      termsDays: i.payment_terms_days ?? 14,
      nextNumber: `${(i.number_prefix ?? "").replaceAll("{year}", today.slice(0, 4))}${String(next).padStart(4, "0")}`,
    },
    missing,
  };
}
