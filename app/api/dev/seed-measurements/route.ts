import { NextResponse } from "next/server";
import { requireCoach } from "../../../lib/auth";
import { getData } from "../../../lib/db";
import { addMetricDefinition, listClients, localDateStr, setCheckInNote, setMetricEntry, weekStart } from "../../../lib/queries";

// Local development only: fills a client's check-ins so the Measurements
// screens have something on them. Adds the usual daily and weekly metrics
// where the client does not have them yet, then a month of daily readings
// and twelve weeks of weekly ones, with the odd day missed and a few notes.
// Running it again rewrites the same periods. Refuses anywhere but a dev
// machine, so it can never run on live.
//   GET http://localhost:3000/api/dev/seed-measurements?client=ID   (signed in as the coach)
export const dynamic = "force-dynamic";

const rnd = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
};
const day = (offset: number) => {
  const d = new Date(`${localDateStr()}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return localDateStr(d);
};

const DAILY = [
  { category: "body", name: "Weight", unit: "kg" },
  { category: "body", name: "Resting HR", unit: "bpm" },
  { category: "sleep", name: "Hours of sleep", unit: "h" },
  { category: "sleep", name: "Morning energy", unit: "/10" },
  { category: "activity", name: "Steps", unit: "steps" },
];
const WEEKLY = [
  { category: "measurements", name: "Waist", unit: "cm" },
  { category: "stress", name: "Stress", unit: "/10" },
  { category: "wellbeing", name: "Mood", unit: "/10" },
  { category: "training", name: "Sessions done", unit: "" },
];

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) return new NextResponse("Not here.", { status: 403 });
  const coach = await requireCoach();
  const asked = Number(new URL(req.url).searchParams.get("client"));
  const client = listClients(coach.id).find((c) => c.id === asked) ?? listClients(coach.id)[0];
  if (!client) return new NextResponse("No client.", { status: 404 });
  const id = client.id;
  const data = getData();
  const rand = rnd(id * 11 + 5);

  // The metrics, by name; added to the standing set where missing.
  const have = (name: string) => data.metric_definitions.find((m) => m.client_id === id && m.name.toLowerCase() === name.toLowerCase());
  for (const m of DAILY) if (!have(m.name)) addMetricDefinition(id, m.category, m.name, m.unit, "daily");
  for (const m of WEEKLY) if (!have(m.name)) addMetricDefinition(id, m.category, m.name, m.unit, "weekly");
  const metric = (name: string) => have(name)!;

  // Thirty days: weight drifting down, sleep and energy moving together, a
  // day skipped now and then, and two whole days missed.
  let kg = 84.6;
  const missed = new Set([day(-9), day(-17)]);
  for (let i = 30; i >= 0; i--) {
    const date = day(-i);
    kg = Math.round((kg - 0.04 + (rand() - 0.5) * 0.7) * 10) / 10;
    if (missed.has(date)) continue;
    const sleep = Math.round((6 + rand() * 2.5) * 2) / 2;
    if (rand() < 0.95) setMetricEntry(metric("Weight").id, date, kg);
    if (rand() < 0.9) setMetricEntry(metric("Hours of sleep").id, date, sleep);
    if (rand() < 0.85) setMetricEntry(metric("Morning energy").id, date, Math.max(3, Math.min(10, Math.round(sleep + (rand() - 0.5) * 3))));
    if (rand() < 0.8) setMetricEntry(metric("Resting HR").id, date, 54 + Math.floor(rand() * 9));
    if (rand() < 0.85) setMetricEntry(metric("Steps").id, date, 6000 + Math.floor(rand() * 7000));
  }
  setCheckInNote(id, "daily", day(-3), "Rough night, the baby was up twice. Skipped the morning walk.");
  setCheckInNote(id, "daily", day(-12), "Weighed in after breakfast by mistake, so a bit high today.");

  // Twelve weeks, this one included: waist easing, stress and mood the other way round.
  const thisWeek = weekStart(localDateStr());
  let waist = 91.5;
  for (let w = 11; w >= 0; w--) {
    const d = new Date(`${thisWeek}T00:00:00`);
    d.setDate(d.getDate() - w * 7);
    const key = localDateStr(d);
    waist = Math.round((waist - 0.2 + (rand() - 0.5) * 0.6) * 10) / 10;
    if (w === 6) continue; // one week missed outright
    const stress = 3 + Math.floor(rand() * 5);
    setMetricEntry(metric("Waist").id, key, waist);
    setMetricEntry(metric("Stress").id, key, stress);
    if (rand() < 0.9) setMetricEntry(metric("Mood").id, key, Math.max(3, Math.min(10, 11 - stress + Math.floor((rand() - 0.5) * 3))));
    if (rand() < 0.9) setMetricEntry(metric("Sessions done").id, key, 2 + Math.floor(rand() * 3));
    if (w === 2) setCheckInNote(id, "weekly", key, "Work deadline this week, stress up and only two sessions. Back to normal from Monday.");
  }

  return NextResponse.redirect(new URL(`/admin/redesign/measurements?client=${id}`, req.url));
}
