import type { ComponentProps } from "react";
import type HomeHub from "../../../client/HomeHub";

// The client's Home in its states, from made-up data (8 Oct): the board
// shows every one side by side, whatever the real clients have on them.
// `naked` is a client with nothing deployed at all; `between` has a phase
// scheduled and nothing live; `full` has everything. Each is the real
// HomeHub, so a change to Home is a change to the board.

export type HomeProps = ComponentProps<typeof HomeHub>;
export type StateId = "naked" | "between" | "full";
export const STATES: { id: StateId; name: string; note: string }[] = [
  { id: "naked", name: "Nothing deployed", note: "A client with no phase, no message, no meeting. Every section still says something." },
  { id: "between", name: "Between phases", note: "The last phase ended; the next is scheduled. Finlay has written once." },
  { id: "full", name: "Everything on", note: "Live phases, a check-in, a session, a meeting, events." },
];

const TODAY = "2026-10-08";
const coach = { firstName: "Finlay", photoPath: null };
const base = {
  dateLabel: "Thursday, October 8",
  firstName: "Sam",
  coach,
  hello: "Good morning",
  today: TODAY,
  recap: null,
  checkInCard: null,
};

export function homeProps(state: StateId): HomeProps {
  if (state === "naked") {
    return {
      ...base,
      session: null,
      progressPics: null,
      latestActivity: { kind: "message", title: "No news from Finlay yet", body: "Your plan shows up here once Finlay sets it up. You can message them any time.", whenLabel: "", cta: "Message Finlay", unread: 0, unseen: false, moreThisWeek: 0 },
      upcoming: null,
      phases: [],
      checkInCount: null,
      weekDone: null,
      trainedToday: false,
      food: null,
      events: { list: [], categories: [] },
      todayNext: null,
      planGap: { next: null },
    };
  }
  if (state === "between") {
    return {
      ...base,
      session: null,
      progressPics: null,
      latestActivity: { kind: "message", title: "Sent you a message", body: "Great block. Rest this week, the next one starts Monday.", whenLabel: "2 days ago", cta: "Reply", unread: 0, unseen: false, moreThisWeek: 1 },
      upcoming: null,
      phases: [],
      checkInCount: null,
      weekDone: null,
      trainedToday: false,
      food: null,
      events: { list: [{ id: 1, kind: "trip", title: "Japan with friends", start: "2026-10-20", end: "2026-11-20", note: "", mine: true }], categories: [{ id: "trip", label: "Trip", color: "blue" }] },
      todayNext: null,
      planGap: { next: { track: "training", name: "Strength block 2", start: "2026-10-12" } },
    };
  }
  return {
    ...base,
    session: { dayId: 1, name: "Lower", exercises: 5, sets: 12, weekNow: 3, sessionIndex: 2, sessionCount: 4, estMinutes: 55, streak: 3 },
    progressPics: { uploaded: 0, total: 3, status: "due", coverUrl: null },
    latestActivity: { kind: "comment", context: "training", title: "Commented on your training", body: "Leg press looked strong, add 5 kg next week.", whenLabel: "Yesterday", cta: "View", unread: 1, unseen: true, moreThisWeek: 2 },
    upcoming: { link: null, provider: "Google Meet", startingNow: false, monthCap: "OCT", dayNumber: "10", weekdayCap: "SAT", topic: "Mid-block check", inLabel: "In 2 days", whenLabel: "Saturday 10:00 · 30 min", startIso: "2026-10-10T08:00:00.000Z", durationMinutes: 30 },
    phases: [
      { id: 1, track: "training", name: "Strength block", start: "2026-09-21", end: "2026-11-01", coverUrl: "/img/session-head.jpg", objectives: ["Squat 100 kg for 5", "Train 4 days a week"], note: null },
      { id: 2, track: "nutrition", name: "Lean bulk", start: "2026-09-21", end: "2026-11-01", coverUrl: "/img/nutrition-head.jpg", objectives: ["2,800 kcal a day", "180 g protein"], note: null },
    ],
    checkInCount: { done: 1, total: 4 },
    weekDone: null,
    trainedToday: false,
    food: { eaten: 1240, target: 2800, mealsLogged: 2, mealsTotal: 4 },
    events: { list: [{ id: 1, kind: "work", title: "Night shifts", start: "2026-10-13", end: "2026-10-17", note: "", mine: false }], categories: [{ id: "work", label: "Work", color: "navy" }] },
    todayNext: null,
    planGap: null,
  };
}
