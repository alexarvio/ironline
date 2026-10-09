import type { HomeEvents } from "../../../client/EventsCard";

// The client's Events screen in its states, from made-up data (9 Oct): the
// board shows every one side by side, whatever the real clients have on
// them. Each is the real EventsScreen, so a change to it is a change here.

export type StateId = "empty" | "coming" | "now" | "history";
export const STATES: { id: StateId; name: string; note: string }[] = [
  { id: "empty", name: "Nothing yet", note: "A client who has added nothing and has nothing from Finlay. Add sits on top; the empty line says what the screen is for." },
  { id: "coming", name: "Coming up", note: "Two of their own and one from Finlay, with his note behind a tap." },
  { id: "now", name: "In one now", note: "Night shifts running, a trip after it, and one that has passed." },
  { id: "history", name: "With a past", note: "A client a few months in: one coming, a run of past ones under it." },
];

export const TODAY = "2026-10-08";
export const COACH = "Finlay";

const categories = [
  { id: "trip", label: "Trip", color: "blue" },
  { id: "health", label: "Health", color: "orange" },
  { id: "work", label: "Work", color: "navy" },
  { id: "family", label: "Family", color: "green" },
];

export function eventsProps(state: StateId): HomeEvents {
  if (state === "empty") return { list: [], categories };
  if (state === "coming") {
    return {
      categories,
      list: [
        { id: 1, kind: "trip", title: "Japan with friends", start: "2026-10-20", end: "2026-11-20", note: "", mine: true },
        { id: 2, kind: "family", title: "Wedding in Groningen", start: "2026-10-17", end: "2026-10-17", note: "", mine: true },
        { id: 3, kind: "training", title: "Deload week", start: "2026-10-12", end: "2026-10-18", note: "Lighter week before the trip: same sessions, two sets fewer each.", mine: false },
      ],
    };
  }
  if (state === "now") {
    return {
      categories,
      list: [
        { id: 1, kind: "work", title: "Night shifts", start: "2026-10-06", end: "2026-10-10", note: "", mine: true },
        { id: 2, kind: "trip", title: "Weekend in Antwerp", start: "2026-10-24", end: "2026-10-25", note: "", mine: true },
        { id: 3, kind: "health", title: "Sprained my ankle", start: "2026-09-22", end: "2026-10-03", note: "", mine: true },
      ],
    };
  }
  return {
    categories,
    list: [
      { id: 1, kind: "trip", title: "Japan with friends", start: "2026-10-20", end: "2026-11-20", note: "", mine: true },
      { id: 2, kind: "health", title: "Sprained my ankle", start: "2026-09-22", end: "2026-10-03", note: "", mine: true },
      { id: 3, kind: "work", title: "Night shifts", start: "2026-09-08", end: "2026-09-12", note: "", mine: true },
      { id: 4, kind: "supplement", title: "Started creatine, 5 g a day", start: "2026-08-25", end: "2026-08-25", note: "", mine: true },
      { id: 5, kind: "training", title: "Deload week", start: "2026-08-11", end: "2026-08-17", note: "Lighter week after the holiday.", mine: false },
      { id: 6, kind: "trip", title: "Two weeks in Portugal", start: "2026-07-20", end: "2026-08-03", note: "", mine: true },
    ],
  };
}
