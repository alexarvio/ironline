// The client's Home board (21 Oct, Alex: built from the Home mockup): where each track stands, what the client did
// since the coach last looked, the muscle balance, strength by muscle group, weight across the phase, and the last 30
// days of consistency. One read for the admin's Home tab (loaders.ts loadHome → DraftHome.board).
//
// Muscle groups come from each exercise's first muscle tag (exercises.muscle_tags, "chest,shoulders" → chest):
// back/lats → Back; chest → Chest; shoulders/delts → Shoulders; arms/biceps/triceps/forearms → Arms;
// legs/quads/hamstrings/glutes/calves → Legs; abs/core/obliques → Core. A coach's own library group ("g-shoulders")
// counts by its name, the same way ("Shoulders" → Shoulders, "Glutes" → Legs). Cardio and untagged exercises count nowhere.
//
// A check-in is what the client sends from the check-in: a metric the workout answers (enjoyment, adherence: queries.ts
// workoutFed) is not one, on the Lifestyle tile, in Since and in Consistency alike.

import type { InvoiceEvery, PhaseTrack } from "./db";

export const MUSCLE_GROUPS = ["Back", "Chest", "Shoulders", "Arms", "Legs", "Core"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type PerGroup = Record<MuscleGroup, number>;

/** One day of the consistency strip. */
export type ConsistencyDay = { date: string; trained: boolean; food: boolean; checkIn: boolean; /** A day still to come: a young phase shows 30 days all the same, filling in as they pass (21 Oct, Alex). */ future?: boolean };

/** A week of the consistency strip, for a long phase (over 8 weeks, 21 Oct, Alex): of its days in the phase so far
    (`days`; the current week up to today), how many had each. A week still to come is `future`, its counts 0. */
export type ConsistencyWeek = { start: string; /** Its week of the phase, from 1. */ week: number; days: number; trained: number; food: number; checkIn: number; future?: boolean };

/** One window of the strength card. */
export type StrengthWindow = { since: string; groups: { group: MuscleGroup; pct: number; exercises: number }[] };

/** One window of the muscle balance: this period, and the one just before it of the same length. */
export type MuscleWindow = {
  /** Logged sets per group (a set with reps or weight), and the window before. */
  sets: PerGroup;
  prevSets: PerGroup;
  /** Volume per group in kg (weight × reps, sets with both), and the window before. */
  volume: PerGroup;
  prevVolume: PerGroup;
  /** yyyy-mm-dd, inclusive: the window shown, so the screen can say "7d" and the phase its dates. */
  from: string;
  to: string;
};

export type HomeBoard = {
  /** The three tracks in their order (Lifestyle, Training, Nutrition), each with its live phase and the one figure that matters. */
  tracks: {
    track: PhaseTrack;
    /** The phase running today; null when none (the tile then says so in one word and links to Plan). */
    phase: { name: string; weekNow: number; weeks: number } | null;
    /** The figure, big, and what it is (grey): "5" + "of 9 days checked in" (Lifestyle: the phase's days so far); "2" + "of 4 sessions this week"; "2,900 kcal" + "P 200 | C 300 | F 80". */
    figure: { value: string; suffix: string } | null;
    /** A second quiet fact under the figure, when there is one: Nutrition's "logged avg 2,640" over the last 7 days with
        food before today (today is still being logged). */
    note: string | null;
  }[];
  /** The Meetings card (21 Oct, Alex): the next call booked, and the last one that is over (held or missed). A title is
      the recap's title once written, else the topic, else the kind's name ("Check-in call", "Review call", "Call"). */
  nextCall: { date: string; time: string | null; title: string } | null;
  lastCall: { date: string; title: string; missed: boolean } | null;
  /** The last invoice paid (its paid day, else its issue day). */
  lastPaid: { date: string; amount: number; currency: string } | null;
  /** The Invoices card: owed (invoices that reached the client and are not paid), and the next recurring invoice to be made. */
  outstanding: { amount: number; currency: string; count: number } | null;
  nextInvoice: { date: string; amount: number; currency: string; every: InvoiceEvery } | null;
  /** What happened since the coach last looked at this client (any of their tabs, 30 minutes apart counting as one visit):
      what was saved after that look, by its stamp (a row from before stamps, by its day). Check-ins are days: a daily
      reading on its day, a weekly or monthly one on the day it was sent, a measurement on its date. The weight change is
      the latest reading saved since against the one before it. */
  since: { from: string; sessions: number; checkIns: number; foodDays: number; messages: number; weightChange: number | null } | null;
  muscles: {
    "7d": MuscleWindow;
    "30d": MuscleWindow;
    /** The live training phase, against the same number of days before it; null with no training phase. */
    phase: MuscleWindow | null;
  };
  /** Strength per window (21 Oct, Alex: a 7d | 30d | Phase toggle, as the muscle balance): per group, the mean % change
      (one decimal) of each exercise's best estimated one-rep max (Epley, weight × (1 + reps / 30)). 7d and 30d: this
      window's best against the window before's, for exercises done in both. Phase: since the training phase began (else
      the last 8 weeks), its first session against its latest. Only groups with data; null when none; the screen draws
      all six. `since` is the date the window is measured from. */
  strength: { "7d": StrengthWindow | null; "30d": StrengthWindow | null; phase: StrengthWindow | null };
  /** Weight readings across the current phase (nutrition's, else training's, else lifestyle's; else the last 8 weeks). */
  weight: {
    points: { date: string; value: number }[];
    now: number | null;
    /** Change from the reading nearest the span's start. */
    change: number | null;
    since: string;
    /** At the rate so far (a least-squares line through the points), where they land on the phase's last day. Null without
        a phase, under 4 readings across 2 weeks, or when the phase's end is further ahead than twice the span read. */
    projection: { date: string; value: number } | null;
  } | null;
  /** The last 30 days, oldest first (21 Oct, Alex: 30, not four weeks): trained (a set logged that day, or a session ended or done in full on it), food
      logged, checked in. */
  days: ConsistencyDay[];
  /** Consistency over the phase (21 Oct, Alex: a 30 days | Phase toggle). The phase is the live ones together, the
      earliest first day to the latest last day. Up to 8 weeks, by day: every day from its first to today, oldest first,
      and at least 30: a younger phase runs on into the days still to come (future), so the strip fills up as they pass.
      Longer, by week (21 Oct, Alex: 180 squares don't fit): every week of the phase, the weeks to come included (at most
      53). Null with no live phase. */
  phaseDays: { since: string; by: "day"; days: ConsistencyDay[] } | { since: string; by: "week"; weeks: ConsistencyWeek[] } | null;
};

export { getHomeBoard, noteHomeLooked } from "./homeBoardData";
