import { GYM_COLORS, isGymColor } from "../../lib/gymColors";
import { redirect } from "next/navigation";
import { getData, type InvoiceTemplate } from "../../lib/db";
import { meetingRemindersOn } from "../../lib/meetingReminders";
import { getUserForClient, isOwner } from "../../lib/auth";
import { mailConfigured } from "../../lib/mail";
import { clerkOn } from "../../lib/clerk";
import { getCoachSettings, getInvoiceView, listInvoices, listInvoiceTemplates, invoiceRepeatViews, runRecurringInvoices, type FeedEvent, type HomeAction, type InvoiceView, listCoachVideos, exerciseClientCounts, listMeetings } from "../../lib/queries";
import { getHomeBoard, noteHomeLooked } from "../../lib/homeBoard";
import { SERVER_TZ, zonedToUtc } from "../../lib/timezones";
import { hasBankDetails, invoicingFor } from "../../lib/countries";
import {
  clientAttention,
  getActivityFeed,
  getAssignmentsForDay,
  laterSameSlotSessions,
  getClientProfile,
  phaseCheckInDays,
  chatQuote,
  chatUnread,
  mediaWords,
  syncClientLoginEmail,
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
  getFreeSessions,
  listEventCategories,
  feedTimeLabel,
  getOverviewPanel,
  describeMessageLink,
  getClient,
  listChatMessages,
  listMessageLinkTargets,
  getPhotoCadence,
  getPhotoInstructions,
  getPhotoStartDate,
  getProgramCurrentWeekIndex,
  programWeekNow,
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
  metricsInCustomOrder,
  listExercisesByGroup,
  librarySubstitutesFor,
  homeGymId,
  dayGymId,
  gymSessionStats,
  listExercises,
  listNutritionPhases,
  listPrograms,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  photoSheetFor,
  nextPhotoSheet,
  localDateStr,
  METRIC_GROUPS,
  METRIC_LIBRARY,
  metricGroup,
  coachGroups,
  programWeekLabel,
  videoRequestsFor,
  sessionAnswers,
  getWorkoutQuestions,
} from "../../lib/queries";
import { phaseLastDay, phaseWeekIndex, phaseWeeks } from "../../lib/phases";
import type { CardioMove, DraftProgram, Library } from "./training/TrainingDraft";
import type { DraftNutrition } from "./nutrition/NutritionDraft";
import type { DraftMeasurements } from "./measurements/MeasurementsDraft";
import type { DraftPictures } from "./pictures/PicturesDraft";
import type { DraftGoal, DraftMeeting, DraftMeetings } from "./meetings/MeetingsDraft";
import type { DraftPlan } from "./plan/PlanDraft";
import type { DraftHome } from "./home/HomeDraft";
import type { DraftMessages } from "./messages/MessagesDraft";
import type { MessageLink } from "../../lib/messageLinks";
import { dayMonth, dayMonthTime } from "../../lib/dayMonth";
import { metricSummary } from "../../lib/metricSummary";

// What the redesign drafts read, gathered on the server for the shell that
// shows them side by side. Read-only: the drafts save nothing.

/** A short print of a week's contents, to tell two weeks apart without sending them. */
const weekPrint = (parts: unknown) => {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length.toString(36)}.${(h >>> 0).toString(36)}`;
};
// A value as the screen shows it, for weekPrint (20 Oct, Alex: Week 4 was Week 3 and still offered "Copy week 3 here"):
// "" and none alike, 8 and "8" alike, a weight to the half kilo as the Training tab rounds it.
const shownText = (v: unknown) => (v == null ? null : String(v).trim() || null);
const shownNum = (v: unknown) => (v == null || String(v).trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const shownKg = (v: unknown) => {
  const n = shownNum(v);
  return n == null ? null : Math.round(n * 2) / 2;
};

/** The client asked for, else the demo client, else one with a programme, else the first. */
export function pickClient(coachId: number, asked: string | undefined) {
  const clients = listClients(coachId);
  const id = Number(asked);
  const client = clients.find((c) => c.id === id) ?? clients.find((c) => c.name === "Demo Client") ?? clients.find((c) => getDeployedProgram(c.id)) ?? clients[0] ?? null;
  return { clients, client, firstName: client ? (client.name ?? "").split(" ")[0] || "the client" : "the client" };
}

// ---- Training -----------------------------------------------------------------

export function loadTraining(coachId: number, clientId: number, params: { week?: string; program?: string }): { draft: DraftProgram | null; library: Library; cardioMoves: CardioMove[]; videos: { id: number; path: string; name: string; at: string; bytes: number | null }[] } {
  // Every programme the client has had, is on, or has waiting: the switch in
  // the header. The one shown is the one asked for, else the live one.
  const live = getDeployedProgram(clientId);
  const all = listPrograms(clientId);
  const askedProgram = Number(params.program);
  const program = all.find((p) => p.id === askedProgram) ?? live ?? all[0] ?? null;
  const stateOf = (p: (typeof all)[number]) =>
    (p.id === live?.id ? "live" : p.status === "deployed" && live && p.start_week < live.start_week ? "past" : p.status === "deployed" || p.scheduled_at ? "scheduled" : "draft") as "live" | "past" | "scheduled" | "draft";
  const programs = all.map((p) => ({ id: p.id, name: p.name ?? "Programme", weeks: p.total_weeks, state: stateOf(p) }));

  // The client's last top set on each variation of an exercise (15 Oct, the Variation pop-up): newest session first, its heaviest set.
  const clientDayIds = new Set(getData().program_days.filter((pd) => pd.client_id === clientId).map((pd) => pd.id));
  const clientAssignments = getData().workout_assignments.filter((wa) => clientDayIds.has(wa.program_day_id));
  const variationLastFor = (exerciseId: number, gymId: number | null) => {
    const out: { variationId: number | null; weight: number; reps: number; date: string }[] = [];
    const byVariation = new Map<number | null, { weight: number; reps: number; date: string }>();
    for (const wa of clientAssignments) {
      if (wa.exercise_id !== exerciseId || wa.swap) continue;
      const logs = getLogsForAssignment(wa.id).filter((l) => l.weight_kg != null && l.reps != null && (gymId == null || l.gym_id == null || l.gym_id === gymId));
      if (!logs.length) continue;
      const date = logs.map((l) => l.logged_at).sort().pop()!;
      const top = logs.reduce((best, l) => (!best || (l.weight_kg ?? 0) > (best.weight_kg ?? 0) || ((l.weight_kg ?? 0) === (best.weight_kg ?? 0) && (l.reps ?? 0) > (best.reps ?? 0)) ? l : best), logs[0]);
      const key = wa.variation_id ?? null;
      const had = byVariation.get(key);
      if (!had || date > had.date) byVariation.set(key, { weight: top.weight_kg!, reps: top.reps!, date });
    }
    for (const [variationId, last] of byVariation) out.push({ variationId, ...last });
    return out;
  };
  const gymRows = listClientGyms(clientId);
  const gymName = new Map(gymRows.map((g) => [g.id, g.name] as const));
  // Home is the gym marked home (15 Oct: it used to be whichever came first), with each gym's colour and its sessions for the coach's gyms pop-up.
  const homeId = homeGymId(clientId);
  const gymStats = gymSessionStats(clientId);
  const gyms = gymRows.map((g) => {
    const c = GYM_COLORS[isGymColor(g.color) ? g.color : "navy"];
    return { id: g.id, name: g.name, home: g.id === homeId, color: c.hex, rgb: c.rgb, sessions8w: gymStats.get(g.id)?.sessions8w ?? 0, lastSessionAt: gymStats.get(g.id)?.lastUsedAt ?? null, logo: g.logo_path ?? null, kind: g.kind ?? "gym" };
  });

  // The coach's library, for the add-exercise row; cardio has its own form.
  const byGroup = listExercisesByGroup(coachId);
  // Names of every exercise, those taken out of the library too: an
  // alternative or a swap may still point at one.
  const libName = new Map(listExercises(coachId).map((e) => [e.id, e.name] as const));
  // Each with its default cue (the Library page, 5 Oct): the note an exercise
  // starts with when it is added to a session.
  const library: Library = coachGroups(coachId).filter((g) => g.slug !== "cardio" && (byGroup[g.slug]?.length ?? 0) > 0).map((g) => ({
    slug: g.slug,
    label: g.label,
    // group and video (15 Oct): the substitutes and variation pop-ups search by group and show a demo's poster.
    exercises: (byGroup[g.slug] ?? []).map((e) => ({ id: e.id, name: e.name, group: g.slug, video: e.video_url ?? null, ...(e.cue ? { cue: e.cue } : {}), ...(e.variations?.length ? { variations: e.variations.map((v) => ({ id: v.id, name: v.name, video: v.video_url ?? null, ...(v.cue ? { cue: v.cue } : {}) })) } : {}) })),
  }));
  // The coach's cardio movements, offered when a cardio is added, each with its cue.
  const cardioMoves = (byGroup.cardio ?? []).map((e) => ({ name: e.name, cue: e.cue ?? "" }));

  const videos = listCoachVideos(coachId).map((v) => ({ id: v.id, path: v.path, name: v.name, at: v.at, bytes: v.bytes ?? null }));
  const demoClients = exerciseClientCounts(coachId);
  if (!program) return { draft: null, library, cardioMoves, videos };

  // NOW only on the week this calendar week really is (21 Oct, Alex: an ended programme kept NOW on its last week). Ended
  // (a later one is live) or run out (its weeks are behind us): every week is over and none is live; it opens on its last.
  const nowIdx = program.status === "deployed" ? programWeekNow(program) : 0;
  const allOver = stateOf(program) === "past" || nowIdx > program.total_weeks;
  const liveIdx = !allOver && nowIdx >= 1 ? nowIdx : 0;
  const askedWeek = Number(params.week);
  const weekIdx = Number.isInteger(askedWeek) && askedWeek >= 1 && askedWeek <= program.total_weeks ? askedWeek : program.status === "deployed" ? getProgramCurrentWeekIndex(program) : 1;
  const weekNumber = program.start_week + weekIdx - 1;

  const weeks = Array.from({ length: program.total_weeks }, (_, i) => {
    const n = program.start_week + i;
    const days = getWeek(clientId, n);
    // Sessions have no set weekday (any order, any day), so a session counts
    // as not done once its week is over, or sooner once the client skipped it,
    // ended it early or logged part of it.
    const over = i + 1 < liveIdx || allOver;
    // One dot a session, every session, so the dots always count the
    // sessions listed under the week: green once the client completed it
    // (every set logged, every cardio ticked); red when they said they
    // couldn't do it; amber when it was begun and left; grey untouched,
    // whether or not its week is over.
    const dots = days.map((d) => {
      const as = getAssignmentsForDay(d.id);
      const cs = listCardioForDay(d.id);
      if (as.length === 0 && cs.length === 0) return { done: false, missed: false, skipped: false };
      const done = as.every((a) => getLogsForAssignment(a.id).length >= a.sets) && cs.every((c) => isCardioDone(c.id));
      const skipped = !done && !!d.skip_reason;
      const begun = !!d.session_ended_at || as.some((a) => getLogsForAssignment(a.id).length > 0) || cs.some((c) => isCardioDone(c.id));
      return { done, missed: !done && !skipped && begun, skipped };
    });
    void over;
    // What a copy of this week would carry (copyProgramWeek): each session's name and its exercises' prescriptions.
    // Two weeks with the same print need no "Copy week N here" (20 Oct, Alex).
    // Read as shown, not as stored (20 Oct, Alex: Week 4 was Week 3 and still offered it): a gym's weight as its lane
    // shows it (none is the plain weight, {} is none), [] and no alternatives alike, only the ones still in the library;
    // the note's kind, shown nowhere, left out. Sessions in their order.
    const print = weekPrint(
      days.map((d) => [
        shownText(d.label),
        [...getAssignmentsForDay(d.id)]
          .sort((a, b) => a.order_index - b.order_index)
          .map((a) => [
            a.exercise_id,
            a.variation_id ?? null,
            shownText(a.custom_name),
            shownNum(a.sets),
            shownText(a.reps),
            shownKg(a.target_weight_kg),
            gymRows.map((g) => shownKg(a.gym_targets?.[g.id]?.kg ?? a.target_weight_kg)),
            shownNum(a.rpe_target),
            shownNum(a.rest_seconds),
            shownText(a.tempo),
            shownText(a.distance),
            shownText(a.time),
            shownText(a.notes),
            (a.alternatives ?? []).filter((x) => libName.has(x.exercise_id)).map((x) => [x.exercise_id, shownText(x.note)]),
            !!a.demo_hidden,
            !!a.library_substitutes_off,
            [...(a.library_substitutes_hidden ?? [])].sort((x, y) => x - y),
          ]),
        // Its cardio too, now that a week's copy carries it (20 Oct, Alex).
        [...listCardioForDay(d.id)]
          .sort((a, b) => a.order_index - b.order_index)
          .map((c) => [shownText(c.name), shownText(c.time), shownText(c.distance), shownText(c.pace), shownText(c.incline), shownText(c.notes), (c.alternatives ?? []).map((x) => [shownText(x.name), shownText(x.note)])]),
      ]),
    );
    return {
      index: i + 1,
      label: programWeekLabel(program, n),
      print,
      trained: dots.map((x) => x.done),
      missed: dots.map((x) => x.missed),
      skipped: dots.map((x) => x.skipped),
      state: (allOver || i + 1 < liveIdx ? "past" : i + 1 === liveIdx ? "live" : "ahead") as "past" | "live" | "ahead",
    };
  });

  // Every workout the client has ended in this programme, any week, with
  // what they answered on ending it (the workout questionnaire), newest
  // first: the Training tab's answers feed under the questionnaire (6 Oct).
  const answersFeed = Array.from({ length: program.total_weeks }, (_, i) => {
    const n = program.start_week + i;
    return getWeek(clientId, n)
      .map((d, si) => ({ d, si }))
      .filter(({ d }) => d.session_ended_at)
      .map(({ d, si }) => {
        const logs = getAssignmentsForDay(d.id).flatMap((a) => getLogsForAssignment(a.id));
        const gymId = logs.find((l) => l.gym_id != null)?.gym_id ?? null;
        return {
          dayId: d.id,
          weekIdx: i + 1,
          weekLabel: programWeekLabel(program, n),
          name: d.label || `Session ${si + 1}`,
          ended: d.session_ended_at!,
          duration: d.session_started_at && d.session_ended_at ? Math.max(0, Math.round((Date.parse(d.session_ended_at) - Date.parse(d.session_started_at)) / 60000)) : null,
          gym: gymId != null ? gymName.get(gymId) ?? null : null,
          note: d.session_note ?? null,
          answers: sessionAnswers(d).map((a) => ({ label: a.label, kind: a.kind ?? "scale", value: a.value ?? null, text: a.text ?? null, unit: a.unit ?? "" })),
        };
      });
  })
    .flat()
    .sort((a, b) => (a.ended < b.ended ? 1 : -1));

  const days = getWeek(clientId, weekNumber);
  // The chat about an exercise, both sides (the workout's chat button and the
  // coach's replies link a message to it), by assignment, oldest first.
  const aboutExercise = new Map<number, { id: number; mine: boolean; text: string; when: string; at: number; media: { path: string; type: string } | null }[]>();
  for (const m of [...listChatMessages(clientId)].sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    if (m.link?.kind !== "exercise") continue;
    const list = aboutExercise.get(m.link.assignmentId) ?? [];
    list.push({ id: m.id, mine: m.sender === "coach", text: m.text || (m.media_path ? "" : "A file"), when: dayMonthTime(m.created_at), at: new Date(m.created_at).getTime(), media: m.media_path ? { path: m.media_path, type: m.media_type ?? "file" } : null });
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
          /** When the session happened (15 Oct, the progress pop-up): ended, else started, else the first set logged. */
          date: (wd?.session_ended_at ?? wd?.session_started_at ?? wl[0]?.logged_at ?? null)?.slice(0, 10) ?? null,
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
        variationId: a.variation_id ?? null,
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
              when: dayMonth(a.swap.at),
              sets: logs.map((l) => ({ set: l.set_number, kg: l.weight_kg, reps: l.reps, rpe: l.rpe_actual, gym: l.gym_id != null ? gymName.get(l.gym_id) ?? null : null })),
            }
          : null,
        video: v ? { requestId: v.id, recurring: !!v.recurring, state: (v.replied_at ? "replied" : v.file_path ? "in" : "asked") as "asked" | "in" | "replied", note: v.note, reply: v.reply_note ?? null, src: v.file_path ?? null, replySrc: v.reply_file_path ?? null, media: (v.media ?? "video") as "video" | "photo", fromClient: !!v.from_client, about: v.about ?? null, clientNote: v.client_note ?? null, sentAt: v.submitted_at ?? null, repliedAt: v.replied_at ?? null, replyDurationMs: v.reply_duration_ms ?? null, replyAnnotations: v.reply_annotations ?? null } : null,
        demoClients: demoClients.get(a.exercise_id) ?? 1,
        demo: a.exercise_video_url ? { url: a.exercise_video_url, source: "library" as const } : a.demo_url ? { url: a.demo_url, source: "row" as const } : null,
        demoHidden: !!a.demo_hidden,
        history,
        swap: a.swap ? (a.swap.library_exercise_id != null ? libName.get(a.swap.library_exercise_id) ?? null : null) ?? a.swap.custom_name ?? null : null,
        alternatives: (a.alternatives ?? []).filter((x) => libName.has(x.exercise_id)).map((x) => ({ exerciseId: x.exercise_id, name: libName.get(x.exercise_id)!, note: x.note ?? "" })),
        librarySubstitutes: librarySubstitutesFor(a.exercise_id).filter((x) => libName.has(x.exercise_id)).map((x) => ({ exerciseId: x.exercise_id, name: libName.get(x.exercise_id)!, note: x.note ?? "" })),
        libraryOff: !!a.library_substitutes_off,
        libraryHidden: a.library_substitutes_hidden ?? [],
        variationLast: variationLastFor(a.exercise_id, dayGymId(d.id)),
        d7: pct(lastWeek),
        d30: pct(monthBack),
      };
    });
    const cardio = listCardioForDay(d.id).map((c) => ({ id: c.id, name: c.name, time: c.time, pace: c.pace, incline: c.incline, distance: c.distance ?? "", notes: c.notes, done: isCardioDone(c.id), swap: c.swap?.name ?? null, alternatives: (c.alternatives ?? []).map((a) => ({ name: a.name, note: a.note ?? "" })) }));
    const setsPlanned = rows.reduce((t, r) => t + r.sets, 0);
    // A swapped exercise's sets still count as done for the session.
    const setsLogged = rows.reduce((t, r) => t + r.logged.length + (r.swapInfo?.sets.length ?? 0), 0);
    const gym = rows.flatMap((r) => [...r.logged, ...(r.swapInfo?.sets ?? [])]).find((l) => l.gym)?.gym ?? null;
    const duration = d.session_started_at && d.session_ended_at ? Math.max(0, Math.round((Date.parse(d.session_ended_at) - Date.parse(d.session_started_at)) / 60000)) : null;
    // The later weeks "Also delete it from" would reach (20 Oct, Alex: it offered weeks that never had this session): the same slot, nothing logged.
    const laterWeeks = laterSameSlotSessions(d.id)
      .map((id) => getData().program_days.find((x) => x.id === id)?.week_number)
      .filter((n): n is number => n != null)
      .map((n) => n - program.start_week + 1);
    return { id: d.id, number: si + 1, name: d.label || `Session ${si + 1}`, rows, cardio, setsPlanned, setsLogged, gym, skip: d.skip_reason ?? null, duration, ended: d.session_ended_at ?? null, note: d.session_note ?? null, answers: sessionAnswers(d).map((a) => ({ label: a.label, kind: a.kind ?? "scale", value: a.value ?? null, text: a.text ?? null, unit: a.unit ?? "" })), laterWeeks };
  });

  // The client's rogue sessions (19 Oct, Alex): workouts of their own, off
  // the plan, by week of the programme. Not sessions of the week (they count
  // in nothing); shown under it, read only, with what was done.
  const rogue: DraftProgram["rogue"] = {};
  for (let i = 0; i < program.total_weeks; i++) {
    const list = getFreeSessions(clientId, program.start_week + i)
      .filter((d) => d.session_started_at)
      .map((d) => ({
        id: d.id,
        started: d.session_started_at ?? null,
        ended: d.session_ended_at ?? null,
        duration: d.session_started_at && d.session_ended_at ? Math.max(0, Math.round((Date.parse(d.session_ended_at) - Date.parse(d.session_started_at)) / 60000)) : null,
        note: d.session_note ?? null,
        exercises: getAssignmentsForDay(d.id).map((a) => ({
          id: a.id,
          name: a.exercise_name ?? "Exercise",
          sets: [...getLogsForAssignment(a.id)].sort((x, y) => x.set_number - y.set_number).map((l) => ({ n: l.set_number, kg: l.weight_kg, reps: l.reps })),
        })),
        cardio: listCardioForDay(d.id).map((c) => ({ id: c.id, name: c.name, time: c.time, distance: c.distance ?? "", pace: c.pace, incline: c.incline, done: isCardioDone(c.id) })),
      }));
    if (list.length) rogue[i + 1] = list;
  }

  const phase = getData().client_phases.find((p) => p.program_id === program.id) ?? null;
  const noteMeta = getClientProgramNoteMeta(clientId, program.id);
  const draft: DraftProgram = {
    id: program.id,
    planCtx: planCtxOf(clientId),
    programs,
    answersFeed,
    name: program.name ?? "Programme",
    status: stateOf(program),
    totalWeeks: program.total_weeks,
    startWeek: program.start_week,
    phaseId: phase?.id ?? null,
    goals: phase?.objectives ?? [],
    // What the client is asked as they end a workout in this programme.
    workoutQuestions: getWorkoutQuestions(clientId, program.id),
    coachNote: phase?.client_note ?? "",
    startDate: phase?.start_week ?? null,
    endDate: phase?.end_week ?? null,
    weekIdx,
    liveIdx,
    weeks,
    sessions,
    rogue,
    gyms,
    note: noteMeta ? { seen: noteMeta.seen, text: noteMeta.text, when: dayMonth(noteMeta.updatedAt) } : null,
  };
  return { draft, library, cardioMoves, videos };
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
    planCtx: planCtxOf(clientId),
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
export type RailData = { clients: RailClient[]; coach: { name: string; photoPath: string | null }; isOwner: boolean; inviteReady: boolean; /** Sign-in through Clerk: New client sends an invite link, no password. */ clerk: boolean };

/** The left rail's data: every client with whether they need the coach, and the coach at the foot. */
export function loadRail(coach: { id: number; email: string; role: "coach" | "client" }): RailData {
  // A new coach sees the welcome steps first; every redesign page reads the rail, so this is the one gate.
  if (getData().users.find((u) => u.id === coach.id)?.onboarding) redirect("/welcome");
  const feed = getActivityFeed(coach.id);
  const clients = listClients(coach.id).map((c) => {
    const user = getUserForClient(c.id);
    return { id: c.id, name: c.name, avatarPath: c.avatar_path ?? null, attention: clientAttention(c.id, feed), notSignedIn: !user || user.must_change_password };
  });
  const profile = getCoachProfile(coach.id);
  return { clients, coach: { name: profile?.display_name?.trim() || nameFromEmail(coach.email), photoPath: profile?.avatar_path ?? null }, isOwner: isOwner(coach), inviteReady: mailConfigured(), clerk: clerkOn() };
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
  const metrics = listMetricsForPhase(clientId, selected?.id ?? null, real.length === 0 || isLive);
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
  // The log is the phase's own (6 Oct): from its first day to its last, or
  // to today while it runs. A past phase shows its own rows under itself.
  // Without a phase, back to the client's first entry.
  const logSpan = (cadence: "daily" | "weekly" | "monthly") => {
    if (!selected) return periodsSinceFirstEntry(metrics, cadence);
    const from = new Date(`${selected.start_week}T00:00:00`);
    const to = new Date(`${until ?? localDateStr()}T00:00:00`);
    const days = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000)) + 1;
    if (cadence === "daily") return days;
    if (cadence === "weekly") return Math.ceil(days / 7);
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  };
  const fmtWhen = (period: string) => {
    const days = Math.round((new Date(`${period}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === -1) return "yesterday";
    if (days > -7) return `${-days} days ago`;
    return dayMonth(period);
  };
  const startsOn = selected ? dayMonth(selected.start_week) : "";
  return {
    id: selected?.id ?? 0,
    goals: goalsOf(selected?.id),
    // The coach's note to the client on this phase (21 Oct): the Note pill, as on Training.
    coachNote: selected?.client_note ?? "",
    customOrder: metricsInCustomOrder(clientId),
    phases,
    planCtx: planCtxOf(clientId),
    name: selected?.name ?? "Check-ins",
    status: selected ? STATE[selected.status] : "live",
    weeks: selected ? phaseWeeks(selected.start_week, selected.end_week) : 0,
    weekIdx: selected && selected.status === "now" ? phaseWeekIndex(selected.start_week, selected.end_week, today) : null,
    startDate: selected?.start_week ?? null,
    endDate: selected?.end_week ?? null,
    // This phase's own days: one phase's never carry into the next.
    checkInDay: phaseCheckInDays(clientId, selected?.id ?? null).weekly,
    monthDay: phaseCheckInDays(clientId, selected?.id ?? null).monthly,
    groups: METRIC_GROUPS.map((g) => ({ key: g.key, label: g.label, tint: g.tint })),
    metrics: metrics.map((m) => {
      const g = metricGroup(m.category);
      const entries = getMetricEntries([m.id]).filter((e): e is typeof e & { value: number } => e.value != null).sort((a, b) => a.period.localeCompare(b.period));
      const last = entries[entries.length - 1];
      return { id: m.id, name: m.name, unit: m.unit, frequency: m.frequency, groupKey: g.key, groupLabel: g.label, tint: g.tint, summary: metricSummary(m), last: last ? { value: last.value, when: fmtWhen(last.period) } : null };
    }),
    library,
    daily: getLoggedValues(clientId, "daily", started ? Math.min(8, logSpan("daily")) : 0, scope),
    weekly: getLoggedValues(clientId, "weekly", started ? Math.min(5, logSpan("weekly")) : 0, scope),
    // The long sets are the whole phase.
    dailyLong: getLoggedValues(clientId, "daily", started ? logSpan("daily") : 0, scope),
    weeklyLong: getLoggedValues(clientId, "weekly", started ? logSpan("weekly") : 0, scope),
    monthly: getLoggedValues(clientId, "monthly", started ? Math.min(6, logSpan("monthly")) : 0, scope),
    monthlyLong: getLoggedValues(clientId, "monthly", started ? logSpan("monthly") : 0, scope),
    notStarted: !started ? (selected?.status === "draft" ? "Nothing logged yet: this phase is a draft." : `Nothing logged yet: this phase starts ${startsOn}.`) : null,
    notes: (started ? listCheckInNotes(clientId, 500).filter((n) => !until || n.period <= until) : []).map((n) => ({ id: n.id, period: n.period, kind: n.kind, text: n.text })),
  };
}

// ---- Progress pictures ---------------------------------------------------------

const PERIOD_UNIT = { weekly: "Week", biweekly: "Check-in", monthly: "Month", sixweekly: "Block" } as const;
const stampDay = (iso: string) => dayMonth(localDateStr(new Date(iso)));
const stampDayTime = dayMonthTime;

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
  // The Plan tab's phases that ran while a sheet was open (from the day it opened to the day before the next,
  // or today for the newest), so one that began mid-week counts (21 Oct, Alex): Lifestyle, Training, Nutrition, as the Plan's lanes run.
  const trackOrder = ["lifestyle", "training", "nutrition"] as const;
  const phases = listClientPhases(clientId).filter((p) => !p.draft);
  const dayBefore = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return localDateStr(d);
  };
  // A sheet's own stretch: a week, two, a month or six from the day it opened (never past the next sheet).
  // Monthly opens on the start's day of the month, clamped in shorter months (as the sheets themselves: 31 Jan, 28 Feb, 31 Mar).
  const sheetEnd = (from: string) => {
    if (cadence === "monthly") {
      const [y, m] = from.split("-").map(Number);
      const day = Number((startDate ?? from).slice(8, 10));
      return dayBefore(localDateStr(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()))));
    }
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + (cadence === "biweekly" ? 14 : cadence === "sixweekly" ? 42 : 7));
    return dayBefore(localDateStr(d));
  };
  const phasesIn = (from: string, newer: string | undefined) => {
    const end = sheetEnd(from);
    const to = newer && dayBefore(newer) < end ? dayBefore(newer) : end;
    return trackOrder.flatMap((track) => phases.filter((p) => p.track === track && p.start_week <= to && phaseLastDay(p.end_week) >= from).map((p) => ({ id: p.id, track, name: p.name })));
  };

  const sheets = periods.map((period, i) => {
    const cells = slots
      .filter((s) => !s.paused || uploadFor(s.id, period))
      .map((s) => {
        const u = uploadFor(s.id, period);
        return { slotId: s.id, label: s.label, src: u?.file_path ?? null, shot: u ? stampDayTime(u.uploaded_at) : null, shotDay: u ? stampDay(u.uploaded_at) : null };
      });
    const inCount = cells.filter((c) => c.src).length;
    const number = periods.length - i;
    return {
      period,
      title: `${PERIOD_UNIT[cadence]} ${number}`,
      live: period === live,
      complete: cells.length > 0 && inCount === cells.length,
      dateLabel: dayMonth(period),
      inCount,
      total: cells.length,
      cells,
      weight: weightFor(period, periods[i - 1]),
      phases: phasesIn(period, periods[i - 1]),
    };
  });

  // Nothing open (the last sheet is done, the next one's day hasn't come): the next sheet, on its own day, its places
  // empty, at the top of the tab where its angles are set (21 Oct, Alex). Not on the list of sheets until it opens.
  const nextSheet = active.length > 0 && !live ? nextPhotoSheet(clientId, today) : null;
  const upcoming = nextSheet
    ? {
        period: nextSheet,
        title: `${PERIOD_UNIT[cadence]} ${periods.length + 1}`,
        live: false,
        complete: false,
        dateLabel: dayMonth(nextSheet),
        inCount: 0,
        total: active.length,
        cells: active.map((s) => ({ slotId: s.id, label: s.label, src: null, shot: null, shotDay: null })),
        weight: null,
        phases: phasesIn(nextSheet, undefined),
      }
    : null;

  // The coach has nudged the client about the open sheet today already (Remind, 21 Oct).
  const remindedToday = !!live && getData().coach_activity.some((a) => a.client_id === clientId && a.dedupe_key === `photos-remind:${live}:${today}`);

  return {
    cadence,
    startDate,
    nextSheet,
    upcoming,
    since: startDate ?? periods[periods.length - 1] ?? null,
    remindedToday,
    instructions: getPhotoInstructions(clientId) ?? "",
    slots: slots.map((s) => ({ id: s.id, label: s.label, hint: s.hint ?? "", paused: !!s.paused, count: uploads.filter((u) => u.slot_id === s.id).length })),
    sheets,
  };
}

/**
 * How many periods of a cadence reach back from today to the client's first
 * logged entry on these metrics (6 Oct: the coach sees the whole history,
 * not a window). Capped so a years-old client still loads in one go.
 */
function periodsSinceFirstEntry(metrics: { id: number }[], cadence: "daily" | "weekly" | "monthly"): number {
  const first = getMetricEntries(metrics.map((m) => m.id))
    .map((e) => (/^\d{4}-\d{2}-\d{2}/.test(e.period) ? e.period.slice(0, 10) : /^\d{4}-\d{2}$/.test(e.period) ? `${e.period}-01` : null))
    .filter((p): p is string => !!p)
    .sort()[0];
  if (!first) return 0;
  const days = Math.max(0, Math.round((Date.parse(`${localDateStr()}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86400000));
  return cadence === "daily" ? Math.min(730, days + 1) : cadence === "weekly" ? Math.min(104, Math.ceil(days / 7) + 1) : Math.min(24, Math.ceil(days / 30) + 1);
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
    request: data.request,
    upcoming: data.upcoming ? withGoals(data.upcoming) : null,
    alsoScheduled: data.alsoScheduled.map(withGoals),
    past: data.past.map(withGoals),
    goals: goals.filter((g) => !g.done),
    dots: data.dots,
    others: data.others,
    lastLink: data.lastLink,
    coachTz: getCoachSettings(getData().clients.find((c) => c.id === clientId)?.coach_id ?? 0).timezone ?? null,
  };
}

// ---- Plan ------------------------------------------------------------------------

/** How far through the week it is, 0 (Monday 00:00) to 1, in server-local time. */
const intoWeek = () => {
  const now = new Date();
  return (((now.getDay() + 6) % 7) + (now.getHours() + now.getMinutes() / 60) / 24) / 7;
};

/** What the New phase dialog needs on the other tabs (10 Oct): the plan's dates, phases and programmes. */
function planCtxOf(clientId: number): Pick<DraftPlan, "today" | "thisWeek" | "phases" | "programs"> {
  const d = getPlanData(clientId);
  return { today: d.today, thisWeek: d.thisWeek, phases: d.phases, programs: d.programs };
}

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
    mainGoalSavedAt: d.mainGoalSavedAt ? dayMonth(d.mainGoalSavedAt) : null,
    events: listClientEvents(clientId).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start_date, end: e.end_date, note: e.note, byClient: e.added_by === "client", repeat: e.repeat ?? null })),
    eventCategories: listEventCategories(getData().clients.find((c) => c.id === clientId)?.coach_id ?? 0),
  };
}

// ---- Home ------------------------------------------------------------------------

/**
 * Where a Feed row lands in the redesign: on the very thing it is about. A
 * session opens in its programme and week and unfolds (#session-); a food
 * log opens its day in Nutrition (#day-); a programme note opens that
 * programme; an invoice opens the invoice. The rest open their tab. Null
 * for a client who deleted their account: there is nothing left to open.
 */
// ---- A Needs-you item, opened and answered (12 Oct): where a click takes
// the coach, and what a reply from it is about. Shared by Home and the Feed.
export type NeedReply = { area: string; label: string; link: MessageLink | null; focus: number | null };
export type NeedView = HomeAction & { open: string; reply: NeedReply | null };
const NEED_TAB_ROUTE: Record<string, string> = { photos: "pictures" };
const NEED_AREA: Record<string, string> = { training: "Training", nutrition: "Nutrition", measurements: "Check-in", meetings: "Meetings", messages: "Chat", invoices: "Invoice", plan: "Plan", photos: "Shape update" };
/** What the coach fixes on their side: nothing to say to the client from these. */
const NO_REPLY = new Set(["no-phase", "week", "program-ending", "locked"]);
export function needView(clientId: number, a: HomeAction, byId: Map<string, FeedEvent>): NeedView {
  const ev = a.eventId ? byId.get(a.eventId) : undefined;
  const open = a.href ?? (ev ? feedHref(ev) : null) ?? `/admin/redesign/${a.tab ? NEED_TAB_ROUTE[a.tab] ?? a.tab : "home"}?client=${clientId}`;
  if (NO_REPLY.has(a.id)) return { ...a, open, reply: null };
  const area = NEED_AREA[a.tab ?? ""] ?? "Chat";
  // An unanswered message: the chat, at it.
  const msg = /^reply-(\d+)$/.exec(a.id);
  if (msg) return { ...a, open, reply: { area, label: a.title, link: null, focus: Number(msg[1]) } };
  // A video or photo: the reply points at the exercise it is of.
  const vid = /^reply-video-(\d+)$/.exec(a.id);
  if (vid) {
    const data = getData();
    const v = data.video_requests.find((x) => x.id === Number(vid[1]));
    const wa = v ? data.workout_assignments.find((w) => w.id === v.assignment_id) : undefined;
    return { ...a, open, reply: { area: "Training", label: a.title.replace(/ waiting for your reply$/, ""), link: wa ? { kind: "exercise", dayId: wa.program_day_id, assignmentId: wa.id } : null, focus: null } };
  }
  // Something they wrote on a session or a food day: the reply points there.
  const t = ev?.target;
  const link: MessageLink | null = t?.kind === "session" ? { kind: "session", dayId: t.dayId } : t?.kind === "food" ? { kind: "food", date: t.date } : a.id.startsWith("checkin-") ? { kind: "checkin", section: a.id === "checkin-weekly" ? "weekly" : a.id === "checkin-monthly" ? "monthly" : "daily" } : null;
  return { ...a, open, reply: { area, label: a.title, link, focus: null } };
}

export function feedHref(e: Pick<FeedEvent, "clientId" | "tab" | "category" | "target">): string | null {
  const tab = (name: string, rest = "") => `/admin/redesign/${name}?client=${e.clientId}${rest}`;
  const t = e.target;
  if (t?.kind === "gone") return null;
  // A message from the client (2 Oct): what it is about opens (its tab, its
  // day or exercise; Home when it is about nothing), with the chat over it
  // at that message (RedesignShell reads ?chat=).
  if (t?.kind === "chat") {
    const view = t.link ? describeMessageLink(e.clientId, t.link) : null;
    const base = t.link && view && !view.removed ? messageLinkHref(e.clientId, t.link, view.week) : tab("home");
    const [path, hash = ""] = base.split("#");
    return `${path}&chat=${t.messageId}${hash ? `#${hash}` : ""}`;
  }
  if (t?.kind === "invoice") return `/admin/redesign/invoices/${t.invoiceId}`;
  if (t?.kind === "food") return tab("nutrition", `#day-${t.date}`);
  if (t?.kind === "program") return tab("training", `&program=${t.programId}`);
  if (t?.kind === "session") {
    const p = listPrograms(e.clientId).find((x) => t.week >= x.start_week && t.week < x.start_week + x.total_weeks);
    return p ? tab("training", `&program=${p.id}&week=${t.week - p.start_week + 1}#session-${t.dayId}`) : tab("training");
  }
  if (e.category === "billing") return tab("invoices");
  const route: Record<string, string> = { photos: "pictures" };
  return tab(route[e.tab] ?? e.tab);
}

/** Activity keeps each kind's newest this many rows (the screen's filters, HomeDraft FILTERS), so a filter pages through
    its own history while the page stays bounded. */
const HOME_KIND_ROWS = 200;
/** HomeDraft's filters but All, as they sort a row: a row is kept while any kind it falls in has room. */
const HOME_KINDS: ((e: { category: string; tab: string }) => boolean)[] = [
  (e) => e.category === "training",
  (e) => e.category === "nutrition",
  (e) => e.category === "measurements",
  (e) => e.category === "billing",
  (e) => e.category === "meetings" || e.tab === "meetings",
  (e) => (e.category === "messages" || e.category === "notes") && e.tab !== "meetings",
];

export function loadHome(clientId: number): DraftHome {
  // The look is noted first: a new visit moves the last look into prev, so "Since" counts from the coach's previous visit
  // on this first render too, and stays put on every re-read within the visit.
  noteHomeLooked(clientId);
  const board = getHomeBoard(clientId);
  const panel = getOverviewPanel(clientId);
  // Activity is the client's whole feed (not the newest 60 rows), so Invoices or Meetings still has its history for a
  // client who chats every day.
  const coachId = getData().clients.find((c) => c.id === clientId)?.coach_id ?? 0;
  const mine = getActivityFeed(coachId).filter((e) => e.clientId === clientId);
  // The calls that are over (21 Oct, the Home mockup), in Activity with the rest, by when they were: a timed call at its
  // moment in its own timezone, a call with no time at its day's noon (as the feed files a day with no time).
  const today = localDateStr();
  const callAt = (date: string, time: string, tz: string | null | undefined) => {
    if (!time) return new Date(`${date}T12:00:00`).getTime();
    const t = zonedToUtc(date, time, tz || SERVER_TZ).getTime();
    return Number.isFinite(t) ? t : new Date(`${date}T12:00:00`).getTime();
  };
  const calls = listMeetings(clientId)
    .filter((m) => m.status === "completed" || m.status === "no-show" || (m.status === "scheduled" && m.date < today))
    .map((m) => {
      // A call's own title is quoted; without one, the kind in words ("had a check-in call"), never quoted as a title.
      const own = m.summary_title?.trim() || m.topic?.trim();
      const kind = m.meeting_type === "review" ? "review call" : m.meeting_type === "other" ? "call" : "check-in call";
      const what = own ? `a call: “${own}”` : `a ${kind}`;
      // A past call nobody marked held or missed is not said to have happened.
      const text = m.status === "completed" ? `had ${what}` : m.status === "no-show" ? `missed ${what}` : `booked ${what} · not marked`;
      const time = m.all_day ? "" : (m.time ?? "").trim();
      const at = callAt(m.date, time, m.tz);
      return {
        id: `meeting-${m.id}`,
        category: "meetings",
        text,
        note: null,
        // As feedTimeLabel writes the other rows' times, so the screen parts them with the same bar.
        when: time ? `${dayMonth(m.date)} · ${time}` : dayMonth(m.date),
        tab: "meetings",
        href: null as string | null,
        at,
        feed: null as FeedEvent | null,
      };
    });
  const rows = [
    ...mine.map((e) => ({ id: e.id, category: e.category as string, text: e.text, note: e.note, when: feedTimeLabel(e.at, e.timeKnown), tab: e.tab, href: null as string | null, at: e.at, feed: e as FeedEvent | null })),
    ...calls,
  ].sort((a, b) => b.at - a.at);
  // Each kind's newest HOME_KIND_ROWS (a row in no kind counts as one of its own); a kept row's link is read after the cut.
  const room = new Array(HOME_KINDS.length + 1).fill(0) as number[];
  const events = rows
    .filter((e) => {
      const kinds = HOME_KINDS.flatMap((has, i) => (has(e) ? [i] : []));
      if (!kinds.length) kinds.push(HOME_KINDS.length);
      if (!kinds.some((i) => room[i] < HOME_KIND_ROWS)) return false;
      for (const i of kinds) room[i]++;
      return true;
    })
    .map(({ feed, ...e }) => ({ ...e, href: feed ? feedHref(feed) : e.href }));
  // The client's login, the same shape clientAccessAction gives, read here
  // so the App access button has it with the page (it used to fetch it
  // after every client switch: one more round trip).
  syncClientLoginEmail(clientId);
  const user = getUserForClient(clientId);
  const access = {
    email: user?.email ?? null,
    signedUp: !!user && !user.must_change_password,
    mailReady: mailConfigured(),
    codes: process.env.AUTH_PROVIDER === "clerk",
    cardEmail: getClientProfile(clientId)?.email ?? null,
  };
  return {
    access,
    name: panel.name,
    initial: panel.initial,
    avatarPath: panel.avatarPath,
    panel,
    coachNote: panel.coachNote,
    events,
    board,
  };
}

// ---- Messages --------------------------------------------------------------------

/**
 * Where a link in a message opens on the coach's side: the tab, and the
 * programme and week, or the day, it points at (the #part unfolds it there;
 * for an exercise, #session-DAY-ex-ROW scrolls to and marks the row).
 */
export function messageLinkHref(clientId: number, link: MessageLink, week: number | null): string {
  const tab = (name: string, rest = "") => `/admin/redesign/${name}?client=${clientId}${rest}`;
  switch (link.kind) {
    case "session":
    case "exercise": {
      const p = week == null ? null : listPrograms(clientId).find((x) => week >= x.start_week && week < x.start_week + x.total_weeks);
      const part = link.kind === "exercise" ? `#session-${link.dayId}-ex-${link.assignmentId}` : `#session-${link.dayId}`;
      return p ? tab("training", `&program=${p.id}&week=${week! - p.start_week + 1}${part}`) : tab("training");
    }
    case "food":
      return tab("nutrition", `#day-${link.date}`);
    case "nutrition":
      return tab("nutrition");
    // That rhythm's log on the page with that check-in, and that sheet's row (21 Oct: both opened their tab at its top).
    case "checkin":
      return tab("measurements", `#checkin-${link.section}${link.period ? `-${link.period}` : ""}`);
    case "photos":
      return tab("pictures", link.period ? `#sheet-${link.period}` : "");
  }
}

export function loadMessages(clientId: number): DraftMessages {
  const when = dayMonthTime;
  const hrefFor = (link: MessageLink, week: number | null) => messageLinkHref(clientId, link, week);
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
        link: view ? { area: view.area, label: view.label, gone: view.gone, href: view.removed ? undefined : hrefFor(m.link!, view.week) } : null,
        reactions: { coach: m.reactions?.coach ?? null, client: m.reactions?.client ?? null },
        pinned: !!m.pinned,
        edited: !!m.edited_at,
        replyTo: (() => {
          const q = chatQuote(clientId, m.reply_to);
          return q ? { id: q.id, mine: q.sender === "coach", text: q.text } : null;
        })(),
      };
    });
  return { messages, targets: listMessageLinkTargets(clientId), avatarPath: getClient(clientId)?.avatar_path ?? null, unread: chatUnread(clientId) };
}

// ---- Invoices tab: the client's invoices as they print, and what Settings
// gives a new one (numbering, VAT, terms), with what is still missing there.
export type DraftInvoices = {
  today: string;
  invoices: InvoiceView[];
  defaults: { currency: string; vatRate: number; taxLabel: string; pricesIncludeVat: boolean; termsDays: number; nextNumber: string };
  missing: string[];
  /** The coach's saved invoices to start from (21 Oct). */
  templates: InvoiceTemplate[];
  /** This client's recurring invoices (21 Oct). */
  repeats: ReturnType<typeof invoiceRepeatViews>;
};

export function loadInvoices(coachId: number, clientId: number): DraftInvoices {
  const today = localDateStr();
  // A series whose day has come shows its invoice here even before the ten-minute run gets to it; the client's buzz
  // follows the same live-server rule as the timer, so who makes it never decides whether they hear of it.
  runRecurringInvoices(today, meetingRemindersOn(), clientId);
  const s = getCoachSettings(coachId);
  const b = s.business ?? {};
  const i = s.invoicing ?? {};
  const next = Math.max(1, Math.round(i.next_number ?? 1));
  const invoices = listInvoices(clientId)
    .map((inv) => getInvoiceView(inv.id))
    .filter((v): v is InvoiceView => !!v)
    .sort((a, b2) => (a.issueDate === b2.issueDate ? b2.id - a.id : a.issueDate < b2.issueDate ? 1 : -1));
  const eff = invoicingFor(b, i);
  const missing = [!b.business_name && "business name", !(b.address && b.city) && "address", !hasBankDetails(i, eff.country) && "bank details"].filter(Boolean) as string[];
  return {
    today,
    invoices,
    defaults: {
      currency: eff.currency,
      vatRate: eff.rate,
      taxLabel: eff.taxLabel,
      pricesIncludeVat: eff.pricesIncludeVat,
      termsDays: eff.termsDays,
      nextNumber: `${(i.number_prefix ?? "").replaceAll("{year}", today.slice(0, 4))}${String(next).padStart(4, "0")}`,
    },
    missing,
    templates: listInvoiceTemplates(coachId),
    repeats: invoiceRepeatViews(clientId),
  };
}

// ---- The chat dock (12 Oct): every client's chat, for the screens that are
// not one client's. Newest word first, then those with no messages, by name.
export type DockChat = { id: number; name: string; avatarPath: string | null; unread: boolean; last: { text: string; at: number; mine: boolean } | null };
export function loadChatDock(coach: { id: number }): DockChat[] {
  return getData()
    .clients.filter((c) => c.coach_id === coach.id)
    .map((c) => {
      const m = listChatMessages(c.id).filter((x) => x.text.trim() || x.media_path).at(-1) ?? null;
      const at = m ? new Date(m.created_at.includes("T") ? m.created_at : m.created_at.replace(" ", "T")).getTime() : 0;
      return { id: c.id, name: c.name, avatarPath: c.avatar_path ?? null, unread: chatUnread(c.id), last: m ? { text: m.text.trim() || mediaWords(m.media_type), at, mine: m.sender === "coach" } : null };
    })
    .sort((x, y) => (y.last?.at ?? 0) - (x.last?.at ?? 0) || x.name.localeCompare(y.name));
}
