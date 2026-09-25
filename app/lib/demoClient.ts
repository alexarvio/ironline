// A lived-in client, built from nothing: a 12-week programme eight weeks
// in with the sets logged, two gyms, check-ins with two weeks of readings,
// calories, phase goals, a few messages from the coach and meetings (one
// done with a recap, one coming up). Used by the dev seed (to look at the
// coach screens with something on them) and by the App Review account (a
// login Apple's reviewers can try every screen with).
//
// Rebuilding removes any client of the same name first, so it can be run
// again for a fresh one.

import { getData, persist, allocId } from "./db";
import {
  addExerciseToDay,
  addClientGym,
  addClientPhase,
  addMetricDefinition,
  addMeeting,
  addSession,
  completeMeeting,
  createClient,
  deployProgram,
  getWeek,
  listExercises,
  localDateStr,
  logSet,
  removeClient,
  requestExerciseVideo,
  setCalorieLog,
  setCardioDone,
  setDayLabel,
  setMetricEntry,
  setPhaseObjectives,
  sendChatMessage,
  updateMeeting,
} from "./queries";

const day = (offset: number) => {
  const d = new Date(`${localDateStr()}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return localDateStr(d);
};
// Monday of the week `n` weeks from this one.
const monday = (n: number) => {
  const d = new Date(`${localDateStr()}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + n * 7);
  return localDateStr(d);
};
const rnd = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
};

type Row = { names: string[]; sets: number; reps: string; kg: number; rpe: number | null; tempo: string | null; note: string | null };

export function buildDemoClient(coachId: number, name: string): number {
  const data = getData();
  // Only this coach's client of that name: never anyone else's.
  for (const c of data.clients.filter((c) => c.name === name && c.coach_id === coachId)) removeClient(c.id);
  const client = createClient(name, coachId);
  const id = client.id;
  const rand = rnd(id * 7 + 3);

  // The library, by name; whatever this coach has.
  const lib = listExercises(coachId);
  const ex = (...names: string[]) => {
    for (const n of names) {
      const hit = lib.find((e) => e.name.toLowerCase() === n.toLowerCase());
      if (hit) return hit.id;
    }
    return lib.find((e) => !/cardio|run|bike|row|walk/i.test(e.name))?.id ?? lib[0]?.id;
  };

  // Gyms: two, so the per-gym weight columns show.
  addClientGym(id, "Muscle Factory");
  addClientGym(id, "TrainMore");
  const gyms = data.client_gyms.filter((g) => g.client_id === id).map((g) => g.id);

  // A 12-week programme that started 8 weeks ago: weeks 1-8 trained, week 9
  // (this week) half done, 10-12 ahead, so a month of trend has something
  // behind it. Phase first, which makes the programme.
  const TRAINED = 8;
  const phase = addClientPhase(id, "training", "Hypertrophy Block", monday(-TRAINED), monday(12 - TRAINED - 1));
  const programId = phase.program_id!;
  const program = data.training_programs.find((p) => p.id === programId)!;
  const startWeek = program.start_week;

  const push: Row[] = [
    { names: ["Incline Chest Press Machine", "Incline Bench Press", "Bench Press"], sets: 3, reps: "6-8", kg: 60, rpe: 8, tempo: null, note: "Do not lock out the elbows" },
    { names: ["Flat Chest Press Machine", "Dumbbell Bench Press"], sets: 3, reps: "8-10", kg: 50, rpe: 8, tempo: "2-0-2", note: null },
    { names: ["Shoulder Press", "Overhead Press", "Dumbbell Shoulder Press"], sets: 3, reps: "8-10", kg: 40, rpe: 8, tempo: null, note: "Keep the ribs down" },
    { names: ["Cable Lateral Raise", "Lateral Raise"], sets: 3, reps: "12-15", kg: 10, rpe: 9, tempo: null, note: null },
    { names: ["Triceps Pushdown", "Tricep Pushdown", "Cable Triceps Extension"], sets: 3, reps: "10-12", kg: 25, rpe: 9, tempo: null, note: null },
  ];
  const pull: Row[] = [
    { names: ["Lat Pulldown", "Pull-Up", "Pull Up"], sets: 3, reps: "8-10", kg: 65, rpe: 8, tempo: null, note: "Full stretch at the top" },
    { names: ["Seated Cable Row", "Cable Row", "Seated Row"], sets: 3, reps: "8-10", kg: 60, rpe: 8, tempo: "2-1-2", note: null },
    { names: ["Face Pull"], sets: 3, reps: "15", kg: 15, rpe: null, tempo: null, note: null },
    { names: ["Dumbbell Curl", "Bicep Curl", "Biceps Curl"], sets: 3, reps: "10-12", kg: 12, rpe: 9, tempo: null, note: null },
  ];
  const legs: Row[] = [
    { names: ["Back Squat", "Squat", "Barbell Squat"], sets: 4, reps: "5", kg: 100, rpe: 8, tempo: null, note: "Brace before every rep" },
    { names: ["Romanian Deadlift", "RDL"], sets: 3, reps: "8", kg: 90, rpe: 8, tempo: "3-0-1", note: null },
    { names: ["Leg Press"], sets: 3, reps: "10-12", kg: 180, rpe: 8, tempo: null, note: "Do not lock out the legs" },
    { names: ["Leg Extension"], sets: 3, reps: "12-15", kg: 50, rpe: 9, tempo: null, note: null },
    { names: ["Seated Leg Curl", "Leg Curl"], sets: 3, reps: "12-15", kg: 45, rpe: 9, tempo: null, note: null },
    { names: ["Calf Press", "Standing Calf Raise", "Calf Raise"], sets: 4, reps: "12-15", kg: 80, rpe: null, tempo: null, note: "Pause at the bottom" },
  ];
  const upper: Row[] = [
    { names: ["Bench Press", "Barbell Bench Press"], sets: 4, reps: "6", kg: 75, rpe: 8, tempo: null, note: null },
    { names: ["Pendlay Row", "Barbell Row", "Bent Over Row"], sets: 4, reps: "6", kg: 70, rpe: 8, tempo: null, note: "Flat back" },
    { names: ["Dumbbell Shoulder Press", "Shoulder Press"], sets: 3, reps: "10", kg: 22, rpe: 8, tempo: null, note: null },
    { names: ["Chest Supported Row", "Dumbbell Row"], sets: 3, reps: "10-12", kg: 24, rpe: 9, tempo: null, note: null },
  ];
  const sessions: { label: string; rows: Row[]; cardio?: { name: string; time: string; pace: string; incline: string; notes: string } }[] = [
    { label: "Push", rows: push },
    { label: "Pull", rows: pull },
    { label: "Legs", rows: legs, cardio: { name: "Incline walk", time: "15 min", pace: "6 km/h", incline: "8%", notes: "Cool-down, easy" } },
    { label: "Upper", rows: upper },
  ];

  // Build every week the same, weights stepping up 2.5% a week.
  for (let w = 0; w < program.total_weeks; w++) {
    const week = startWeek + w;
    while (getWeek(id, week).length < sessions.length) addSession(id, week);
    const days = getWeek(id, week);
    sessions.forEach((s, si) => {
      const d = days[si];
      setDayLabel(d.id, s.label);
      s.rows.forEach((r, ri) => {
        // Most exercises climb 2.5% a week; every fourth stalls for a fortnight
        // mid-block, and one in the session dips a step back at week 6, so the
        // trends read as a real client, not a ramp.
        const stall = ri % 4 === 1 && w >= 4 && w <= 5 ? 4 : w;
        const dip = ri % 5 === 3 && w === 6 ? -0.035 : 0;
        const kg = Math.round((r.kg * (1 + 0.025 * stall + dip)) / 2.5) * 2.5;
        addExerciseToDay(d.id, ex(...r.names), r.sets, r.reps, kg, r.rpe, r.tempo, r.note);
      });
      if (s.cardio) {
        data.cardio_entries.push({ id: allocId("cardio_entries"), program_day_id: d.id, name: s.cardio.name, time: s.cardio.time, pace: s.cardio.pace, incline: s.cardio.incline, distance: "", notes: s.cardio.notes, order_index: 0 });
      }
    });
  }
  persist();
  deployProgram(programId);
  // Deployed when it started, so "started" reads back then.
  program.deployed_at = new Date(`${monday(-TRAINED)}T09:00:00`).toISOString();
  phase.draft = false;
  persist();

  // Logs: the trained weeks every session (one week skipped entirely, one
  // session missed in another, so gaps show), this week the first two
  // sessions. The set's date is that week's Mon / Wed / Fri / Sat, at
  // alternating gyms.
  const dayOffsets = [0, 2, 4, 5];
  for (let w = 0; w <= TRAINED; w++) {
    if (w === 3) continue; // a week away
    const week = startWeek + w;
    const days = getWeek(id, week);
    const sessionsDone = w < TRAINED ? (w === 5 ? sessions.length - 1 : sessions.length) : 2;
    for (let si = 0; si < sessionsDone; si++) {
      const d = days[si];
      const when = new Date(`${monday(w - TRAINED)}T00:00:00`);
      when.setDate(when.getDate() + dayOffsets[si]);
      const stamp = `${localDateStr(when)}T${String(7 + Math.floor(rand() * 11)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00`;
      const gym = gyms[(w + si) % gyms.length];
      for (const a of data.workout_assignments.filter((x) => x.program_day_id === d.id)) {
        const target = a.target_weight_kg ?? 0;
        const low = Number(String(a.reps).split("-")[0]) || 8;
        for (let n = 1; n <= a.sets; n++) {
          // Mostly on target, a wobble now and then; the last set a rep short sometimes.
          const kg = rand() < 0.15 ? target - 2.5 : target;
          const reps = n === a.sets && rand() < 0.35 ? low - 1 : low + Math.floor(rand() * 2);
          logSet(a.id, n, kg, reps, a.rpe_target ? Math.min(10, a.rpe_target + (rand() < 0.3 ? 1 : 0)) : null, gym);
          const row = data.set_logs.find((l) => l.workout_assignment_id === a.id && l.set_number === n);
          if (row) row.logged_at = stamp;
        }
      }
      for (const c of data.cardio_entries.filter((c) => c.program_day_id === d.id)) setCardioDone(c.id, true);
    }
  }
  persist();

  // A video asked for on this week's first Push exercise: waiting on the client.
  const thisWeekPush = getWeek(id, startWeek + TRAINED)[0];
  const first = data.workout_assignments.find((a) => a.program_day_id === thisWeekPush.id);
  if (first) requestExerciseVideo(first.id, "Film the top set from the side, please.");

  // Check-in: three daily metrics with two weeks of readings, plus calories.
  addMetricDefinition(id, "body", "Weight", "kg", "daily");
  addMetricDefinition(id, "sleep", "Hours of sleep", "h", "daily");
  addMetricDefinition(id, "activity", "Steps", "steps", "daily");
  const metric = (name: string) => data.metric_definitions.find((m) => m.client_id === id && m.name === name);
  const weight = metric("Weight");
  const sleep = metric("Hours of sleep");
  const steps = metric("Steps");
  let kg = 88.4;
  for (let i = 14; i >= 0; i--) {
    const date = day(-i);
    kg = Math.round((kg - 0.05 + (rand() - 0.5) * 0.6) * 10) / 10;
    if (rand() < 0.9 && weight) setMetricEntry(weight.id, date, kg);
    if (rand() < 0.85 && sleep) setMetricEntry(sleep.id, date, Math.round((6 + rand() * 2.5) * 2) / 2);
    if (rand() < 0.85 && steps) setMetricEntry(steps.id, date, 5000 + Math.floor(rand() * 7000));
    if (rand() < 0.8) setCalorieLog(id, date, 2400 + Math.floor((rand() - 0.5) * 700), null, rand() < 0.6 ? "training" : "rest");
  }
  persist();

  // The coach's goals for the phase, on the client's Home.
  setPhaseObjectives(phase.id, ["Add 5–10% to the main lifts", "Train four times a week", "Keep bodyweight within a kilo"]);

  // A few messages, the coach's first.
  const msgs: { from: "coach" | "client"; text: string; daysAgo: number }[] = [
    { from: "coach", text: "Welcome in! Your programme is live: four sessions a week. Log every set as you go and I'll check in after each session.", daysAgo: 55 },
    { from: "client", text: "Thanks! Just did Push, felt strong.", daysAgo: 55 },
    { from: "coach", text: "Great numbers on the incline press this week. We'll add a little weight next week.", daysAgo: 6 },
    { from: "client", text: "Sounds good. The leg press was taken on Friday, I did hack squats instead.", daysAgo: 3 },
    { from: "coach", text: "Perfect, that's exactly what the swap is for.", daysAgo: 3 },
  ];
  for (const m of msgs) {
    sendChatMessage(id, m.from, m.text);
    const row = data.chat_messages[data.chat_messages.length - 1];
    const at = new Date();
    at.setDate(at.getDate() - m.daysAgo);
    row.created_at = at.toISOString();
  }
  persist();

  // Meetings: last one done, with its recap for the client; the next in four days.
  addMeeting(id, day(-12), "18:00", "Mid-block check-in", 30, "https://meet.google.com/demo-review-call");
  const past = data.meetings[data.meetings.length - 1];
  updateMeeting(past.id, { summary_title: "Keep the calories, push the lifts", summary: "Calories stay where they are: bodyweight is steady and the lifts keep moving. From next week the top sets go up 2.5 kg where the last set was at RPE 8 or below." });
  completeMeeting(past.id);
  addMeeting(id, day(4), "18:00", "End of block review", 30, "https://meet.google.com/demo-review-call");

  return id;
}
