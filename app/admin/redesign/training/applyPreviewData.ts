import { getData } from "../../../lib/db";
import { MAX_SESSIONS_PER_WEEK, assignmentsForDayIn, cardioForDayIn, getAssignmentsForDay, getWeek, homeGymId, listCardioForDay, listClientGyms, trainingIndex, weekIn } from "../../../lib/queries";
import { assistedRow, beforeStop, copiedWeights, laneKg, laneOfGym, laterSlot, liftOf, raisedTo, setsSinceReset, stopAfter, writeLane, type Lane } from "../../../lib/targetRule";
import { changedWeeks, type ApplyFig, type ApplyItem, type ApplyPreview, type ApplySession, type ApplyWeek } from "./applyShape";

// What Apply to the rest (copyProgramWeek, one target week at a time) and a session's Apply to remaining weeks
// (copyProgramDayToLaterWeeks → copyProgramDay) would change in the later weeks (23 Oct, Alex: "naming nicely and
// structured the changes that we are applying"). Read only: it walks the same weeks and slots the actions do and
// compares what is there with what would land, as the Training tab shows it (a weight as the rule that writes it
// forward will leave it, a video ask going with its row), so it never names a change the action won't make. The
// week's copy leaves a session with anything logged as it is; a session's copy replaces it, logs and all, and says
// what goes. The confirm reads it (applyPreview.ts), and so does the Training tab's page read, which offers either
// apply only while it would change something (23 Oct, Alex: "once I apply and there are no other changes, the button
// disappears").

type Day = ReturnType<typeof getWeek>[number];
type Row = ReturnType<typeof getAssignmentsForDay>[number];
type Cardio = ReturnType<typeof listCardioForDay>[number];
/** A programme's weeks, as the client's calendar numbers them. */
type Span = { start_week: number; total_weeks: number };

// As the screen shows a value (loaders' weekPrint): "" and none alike, 8 and "8" alike. A weight goes as stored: the
// screen turns it into the coach's unit and rounds it there, as the Training tab does (135 lb is 61.235 kg).
const txt = (v: unknown) => (v == null ? null : String(v).trim() || null);
const num = (v: unknown) => (v == null || String(v).trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const kgv = num;
const restOf = (s: number | null) => (s == null ? null : s >= 60 && s % 60 === 0 ? `${s / 60} min` : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`);
const nameOf = (d: { label: string | null }, position: number) => txt(d.label) ?? `Session ${position}`;

/** `gone`: the sessions the copy replaces, their rows (and what was logged or asked on them) with them. */
function compare(clientId: number, gone: Set<number>) {
  const data = getData();
  const exName = new Map(data.exercises.map((e) => [e.id, e.name] as const));
  const exById = new Map(data.exercises.map((e) => [e.id, e] as const));
  const gyms = listClientGyms(clientId);
  const home = homeGymId(clientId);
  const awayGyms = gyms.length > 1 ? gyms.filter((g) => g.id !== home) : [];
  const dayOf = new Map(data.program_days.map((d) => [d.id, d] as const));
  const waOf = new Map(data.workout_assignments.map((w) => [w.id, w] as const));
  // This client's rows and what was logged on them, once: the page's read asks for many sessions at a time.
  const rowsOfDay = new Map<number, number[]>();
  for (const wa of data.workout_assignments) {
    if (dayOf.get(wa.program_day_id)?.client_id !== clientId) continue;
    const list = rowsOfDay.get(wa.program_day_id);
    if (list) list.push(wa.id);
    else rowsOfDay.set(wa.program_day_id, [wa.id]);
  }
  const clientRows = new Set([...rowsOfDay.values()].flat());
  const logsOf = new Map<number, (typeof data.set_logs)[number][]>();
  for (const l of data.set_logs) {
    if (!clientRows.has(l.workout_assignment_id)) continue;
    const list = logsOf.get(l.workout_assignment_id);
    if (list) list.push(l);
    else logsOf.set(l.workout_assignment_id, [l]);
  }
  const cardioOfDay = new Map<number, number[]>();
  for (const c of data.cardio_entries ?? []) {
    if (dayOf.get(c.program_day_id)?.client_id !== clientId) continue;
    const list = cardioOfDay.get(c.program_day_id);
    if (list) list.push(c.id);
    else cardioOfDay.set(c.program_day_id, [c.id]);
  }
  const clientCardio = new Set([...cardioOfDay.values()].flat());
  const cardioTicks = new Map<number, number>();
  for (const l of data.cardio_logs ?? []) if (clientCardio.has(l.cardio_entry_id)) cardioTicks.set(l.cardio_entry_id, (cardioTicks.get(l.cardio_entry_id) ?? 0) + 1);
  const askOf = new Map<number, (typeof data.video_requests)[number]>();
  for (const r of data.video_requests) if (!askOf.has(r.assignment_id)) askOf.set(r.assignment_id, r);
  const recurring = data.video_requests.filter((r) => r.recurring && r.client_id === clientId && !r.from_client);
  // The client's sessions, rows and cardio read once for every preview (23 Oct, speed), exactly as the plain reads give them.
  const ix = trainingIndex(clientId);

  // This client's rows of each exercise on planned days, where they sit: a copy reads the coach's resets off them.
  const rowsOfExercise = new Map<number, { slot: (typeof data.program_days)[number]; row: (typeof data.workout_assignments)[number] }[]>();
  for (const wa of data.workout_assignments) {
    const d = dayOf.get(wa.program_day_id);
    if (!d || d.client_id !== clientId || d.free) continue;
    const list = rowsOfExercise.get(wa.exercise_id);
    if (list) list.push({ slot: d, row: wa });
    else rowsOfExercise.set(wa.exercise_id, [{ slot: d, row: wa }]);
  }

  /**
   * A copied row's weights once the rule that writes them forward (progressTargetFromLogs, on every request) has
   * passed over it: the same rule (lib/targetRule.ts), on the copy alone. The copy carries the source's weights and when
   * they were typed, never a reset (copiedWeights), so an earlier logged row of the same exercise that met its weight
   * raises it again, unless a reset of the coach's that stays on the plan sits between them.
   */
  const landed = (row: Row, dest: Day): Row => {
    if (!waOf.get(row.id) || dest.free) return row;
    const copy = copiedWeights(row);
    // What stays on the plan once the copy is made: a session it replaces goes, its resets with it.
    const stays = (rowsOfExercise.get(row.exercise_id) ?? []).filter((o) => !gone.has(o.slot.id));
    for (const [id, logs] of logsOf) {
      const wa = waOf.get(id);
      const day = wa ? dayOf.get(wa.program_day_id) : undefined;
      if (!wa || !day || wa.swap || day.free || wa.exercise_id === 0 || wa.exercise_id !== row.exercise_id || day.client_id !== clientId || gone.has(day.id)) continue;
      if (!laterSlot(dest, day)) continue;
      const assisted = assistedRow(exById.get(wa.exercise_id), wa.variation_id);
      const lanes = new Map<Lane, typeof logs>();
      for (const sl of logs) {
        const lane = laneOfGym(sl.gym_id, home);
        lanes.set(lane, [...(lanes.get(lane) ?? []), sl]);
      }
      for (const [lane, ls] of lanes) {
        const lift = liftOf(setsSinceReset(ls, wa, lane), laneKg(wa, lane), lane, assisted);
        if (!lift || !beforeStop(dest, stopAfter(day, stays, lane))) continue;
        const kg = raisedTo(copy, lane, lift, assisted);
        if (kg != null) writeLane(copy, lane, kg);
      }
    }
    return copy;
  };

  /** A recurring ask on an earlier session of the same name makes the copied row one of its own (resolveRecurringVideoAsks). */
  const askRemade = (row: Row, dest: Day, label: string | null) => {
    const name = (label ?? "").trim().toLowerCase();
    if (!name) return false;
    return recurring.some((p) => {
      const pa = waOf.get(p.assignment_id);
      const pd = pa ? dayOf.get(pa.program_day_id) : undefined;
      return !!pa && !!pd && !gone.has(pd.id) && pa.exercise_id === row.exercise_id && (pd.label ?? "").trim().toLowerCase() === name && pd.week_number < dest.week_number;
    });
  };

  const push = (out: ApplyFig[], label: string, from: string | number | null, to: string | number | null, more: Partial<ApplyFig> = {}) => {
    const a = from == null ? null : String(from);
    const b = to == null ? null : String(to);
    if (a !== b) out.push({ label, from: a, to: b, ...more });
  };
  const subs = (r: Row) => (r.alternatives ?? []).filter((x) => exName.has(x.exercise_id));
  const subsWords = (r: Row) => subs(r).map((x) => exName.get(x.exercise_id)!).join(", ") || null;
  const libraryWords = (r: Row) => (r.library_substitutes_off ? "Off" : r.library_substitutes_hidden?.length ? `${r.library_substitutes_hidden.length} hidden` : "On");

  const rowFigs = (from: Row, to: Row): ApplyFig[] => {
    const out: ApplyFig[] = [];
    push(out, "Sets", num(from.sets), num(to.sets));
    push(out, "Reps", txt(from.reps), txt(to.reps));
    push(out, "kg", kgv(from.target_weight_kg), kgv(to.target_weight_kg), { kg: true });
    // Another gym's weight, only where one side has its own (else it follows the weight above).
    for (const g of awayGyms) {
      const own = (r: Row) => r.gym_targets?.[g.id]?.kg ?? null;
      if (own(from) == null && own(to) == null) continue;
      push(out, "kg", kgv(own(from) ?? from.target_weight_kg), kgv(own(to) ?? to.target_weight_kg), { kg: true, gym: g.name });
    }
    push(out, "RPE", num(from.rpe_target), num(to.rpe_target));
    push(out, "Tempo", txt(from.tempo), txt(to.tempo));
    push(out, "Rest", restOf(num(from.rest_seconds)), restOf(num(to.rest_seconds)));
    push(out, "Time", txt(from.time), txt(to.time));
    push(out, "Distance", txt(from.distance), txt(to.distance));
    push(out, "Note", txt(from.notes), txt(to.notes), { words: true });
    if (JSON.stringify(subs(from).map((x) => [x.exercise_id, txt(x.note)])) !== JSON.stringify(subs(to).map((x) => [x.exercise_id, txt(x.note)]))) {
      out.push({ label: "Substitutes", from: subsWords(from), to: subsWords(to) });
    }
    const hidden = (r: Row) => JSON.stringify([!!r.library_substitutes_off, [...(r.library_substitutes_hidden ?? [])].sort((x, y) => x - y)]);
    if (hidden(from) !== hidden(to)) out.push({ label: "Library substitutes", from: libraryWords(from), to: libraryWords(to) });
    push(out, "Demo", from.demo_hidden ? "Hidden" : "Shown", to.demo_hidden ? "Hidden" : "Shown");
    return out;
  };
  const cardioFigs = (from: Cardio, to: Cardio): ApplyFig[] => {
    const out: ApplyFig[] = [];
    push(out, "Time", txt(from.time), txt(to.time));
    push(out, "Pace", txt(from.pace), txt(to.pace));
    push(out, "Incline", txt(from.incline), txt(to.incline));
    push(out, "Distance", txt(from.distance), txt(to.distance));
    push(out, "Note", txt(from.notes), txt(to.notes), { words: true });
    const alt = (c: Cardio) => (c.alternatives ?? []).map((x) => [txt(x.name), txt(x.note)]);
    if (JSON.stringify(alt(from)) !== JSON.stringify(alt(to))) {
      const words = (c: Cardio) => (c.alternatives ?? []).map((x) => x.name.trim()).filter(Boolean).join(", ") || null;
      out.push({ label: "Substitutes", from: words(from), to: words(to) });
    }
    return out;
  };

  /** Pairs what is there with what lands, in the order it lands: the same exercise (and variation), else added / removed. */
  function pair<T>(src: T[], dest: T[], key: (x: T) => string) {
    const used = new Set<number>();
    const pairs: { src: T; dest: T | null; at: number }[] = src.map((s) => {
      const at = dest.findIndex((d, i) => !used.has(i) && key(d) === key(s));
      if (at >= 0) used.add(at);
      return { src: s, dest: at >= 0 ? dest[at] : null, at };
    });
    const removed = dest.filter((_, i) => !used.has(i));
    const kept = pairs.filter((p) => p.dest != null).map((p) => p.at);
    const reorder = kept.some((at, i) => i > 0 && at < kept[i - 1]);
    return { pairs, removed, reorder };
  }

  /** What `dest` (null: made by the copy) becomes when `src` is copied onto it, at slot `position`. */
  const session = (src: Day, dest: Day | null, position: number, logs: { sets: number; cardio: number } | null): ApplySession | null => {
    const srcRows = assignmentsForDayIn(ix, src.id);
    const srcCardio = cardioForDayIn(ix, src.id);
    const name = nameOf(src, position);
    if (!dest) return { name, was: null, added: { exercises: srcRows.length, cardio: srcCardio.length }, reorder: false, goes: null, items: [] };
    const destRows = assignmentsForDayIn(ix, dest.id);
    const destCardio = cardioForDayIn(ix, dest.id);
    const items: ApplyItem[] = [];
    const rows = pair(srcRows, destRows, (r) => `${r.exercise_id}:${r.variation_id ?? ""}:${txt(r.custom_name) ?? ""}`);
    for (const p of rows.pairs) {
      const name = p.src.exercise_name ?? "Exercise";
      if (!p.dest) items.push({ name, change: "added", figs: [] });
      else {
        const figs = rowFigs(p.dest, landed(p.src, dest));
        // An ask is the row's (videoRequestsFor), so it goes with the row the copy replaces, unless a recurring one makes it again.
        const ask = askOf.get(p.dest.id);
        if (ask) push(figs, "Video", ask.file_path ? "Sent" : "Asked", askRemade(p.src, dest, src.label) ? "Asked" : null);
        if (figs.length) items.push({ name, change: "changed", figs });
      }
    }
    for (const r of rows.removed) items.push({ name: r.exercise_name ?? "Exercise", change: "removed", figs: [] });
    const cardio = pair(srcCardio, destCardio, (c) => (txt(c.name) ?? "").toLowerCase());
    for (const p of cardio.pairs) {
      const name = txt(p.src.name) ?? "Cardio";
      if (!p.dest) items.push({ name, cardio: true, change: "added", figs: [] });
      else {
        const figs = cardioFigs(p.dest, p.src);
        if (figs.length) items.push({ name, cardio: true, change: "changed", figs });
      }
    }
    for (const c of cardio.removed) items.push({ name: txt(c.name) ?? "Cardio", cardio: true, change: "removed", figs: [] });
    const was = nameOf(dest, position) !== name ? nameOf(dest, position) : null;
    const reorder = rows.reorder || cardio.reorder;
    // Replaced even when it reads the same: what the client logged on it goes all the same.
    const goes = logs && (logs.sets > 0 || logs.cardio > 0) ? logs : null;
    if (!items.length && !was && !reorder && !goes) return null;
    return { name, was, added: null, reorder, goes, items };
  };

  /** What the client logged on a session: its sets, its ticked cardio. */
  const logged = (dayId: number) => ({
    sets: (rowsOfDay.get(dayId) ?? []).reduce((t, id) => t + (logsOf.get(id)?.length ?? 0), 0),
    cardio: (cardioOfDay.get(dayId) ?? []).reduce((t, id) => t + (cardioTicks.get(id) ?? 0), 0),
  });

  /**
   * A later week as the copy finds it, slot by slot (sessionAt with create): a slot that isn't there is made, the
   * week growing to reach it, unless the week is full or has a later slot already. Returns null when nothing lands.
   */
  const weekSlots = (week: number) => {
    const days = weekIn(ix, clientId, week);
    const positions = new Set(days.map((d) => d.day_of_week));
    let count = days.length;
    let top = days.reduce((m, d) => Math.max(m, d.day_of_week), 0);
    return (position: number): { dest: Day | null; made: number[] } | null => {
      const hit = days.find((d) => d.day_of_week === position);
      if (hit) return { dest: hit, made: [] };
      // Made earlier in this walk: it lands on that new, empty session.
      if (positions.has(position)) return { dest: null, made: [] };
      if (top > position) return null;
      const made: number[] = [];
      while (top < position) {
        if (count >= MAX_SESSIONS_PER_WEEK) return null;
        top += 1;
        count += 1;
        positions.add(top);
        made.push(top);
      }
      return { dest: null, made };
    };
  };

  return { session, logged, weekSlots };
}

/** One read of the client's plan for any number of previews (the page's read asks for the week's and each session's). */
export function applyReader(clientId: number) {
  const gone = new Set<number>();
  const c = compare(clientId, gone);

  /** Apply to the rest: the week `fromWeek` copied onto each of `toWeeks` (copyProgramWeek). */
  const week = (program: Span, fromWeek: number, toWeeks: number[]): ApplyPreview => {
    gone.clear();
    const source = getWeek(clientId, fromWeek);
    // Every week's landings first, so each copy is read against the sessions the whole action replaces.
    const plan: { week: number; lands: { src: Day; dest: Day | null }[] }[] = [];
    for (const week of toWeeks) {
      if (week === fromWeek || !Number.isInteger(week)) continue;
      const slot = c.weekSlots(week);
      const lands: { src: Day; dest: Day | null }[] = [];
      for (const src of source) {
        const at = slot(src.day_of_week);
        if (!at) continue;
        if (at.dest) {
          // A session the client has logged on stays as it is.
          const l = c.logged(at.dest.id);
          if (l.sets > 0 || l.cardio > 0) continue;
          gone.add(at.dest.id);
        }
        lands.push({ src, dest: at.dest });
      }
      plan.push({ week, lands });
    }
    const weeks: ApplyWeek[] = plan.map(({ week, lands }) => ({
      index: week - program.start_week + 1,
      sessions: lands.map((l) => c.session(l.src, l.dest, l.src.day_of_week, null)).filter((s): s is ApplySession => s != null),
    }));
    return { weeks };
  };

  /** A session's Apply to remaining weeks: it, as it is, into the same slot of every later week (copyProgramDayToLaterWeeks). */
  const session = (src: Day, program: Span): ApplyPreview => {
    gone.clear();
    // Every week's slot first: the sessions it replaces go, logs and all, before any copy is read.
    const slots: { week: number; at: ReturnType<ReturnType<typeof c.weekSlots>> }[] = [];
    for (let week = src.week_number + 1; week < program.start_week + program.total_weeks; week++) {
      const at = c.weekSlots(week)(src.day_of_week);
      if (at?.dest) gone.add(at.dest.id);
      slots.push({ week, at });
    }
    const weeks: ApplyWeek[] = [];
    for (const { week, at } of slots) {
      const sessions: ApplySession[] = [];
      if (at) {
        // The week grows to reach the slot: the sessions before it come empty.
        for (const p of at.made.slice(0, -1)) sessions.push({ name: `Session ${p}`, was: null, added: { exercises: 0, cardio: 0 }, reorder: false, goes: null, items: [] });
        const s = c.session(src, at.dest, src.day_of_week, at.dest ? c.logged(at.dest.id) : null);
        if (s) sessions.push(s);
      }
      weeks.push({ index: week - program.start_week + 1, sessions });
    }
    return { weeks };
  };

  return { week, session };
}

/**
 * The Training tab's read of week `weekNumber` (loadTraining): the later weeks Apply to the rest would change, and for
 * each of the week's sessions whether its own Apply to remaining weeks would change one, each in kg and in lbs as the
 * confirm shows a weight. The same reads as the confirm's, so the button is there exactly while its list has something.
 * Null when no week comes after it.
 */
export function applyReads(clientId: number, program: Span, weekNumber: number) {
  const later: number[] = [];
  for (let w = weekNumber + 1; w < program.start_week + program.total_weeks; w++) later.push(w);
  if (!later.length) return null;
  const read = applyReader(clientId);
  const rest = read.week(program, weekNumber, later);
  const sessions: Record<number, { kg: boolean; lbs: boolean }> = {};
  for (const d of getWeek(clientId, weekNumber)) {
    const p = read.session(d, program);
    sessions[d.id] = { kg: changedWeeks(p, false).length > 0, lbs: changedWeeks(p, true).length > 0 };
  }
  return { rest: { kg: changedWeeks(rest, false), lbs: changedWeeks(rest, true) }, sessions };
}
