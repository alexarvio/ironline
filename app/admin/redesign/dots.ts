// The dot trail (22 Oct, Alex): what the coach owes a client, marked with a rust dot at each step down to it, so the
// rail's number leads somewhere: the client's tab, then on Training the week, then the session, then the exercise (its
// video mark, rust while it waits). The same things the rail counts (the Feed's Needs you), worked out once on the
// server (loadDots in loaders.ts) and handed to every tab. A dot goes when the thing is done (replied, reviewed, read,
// booked), never just by looking. The chat keeps its own dot on the chat tab (unread, gone on opening). Styles: .rd-due
// in training/draft.css. At the top of each tab the same things say what they are and carry their action (todo,
// TodoStrip.tsx; 2 Nov, Alex).

/** The client tabs as RedesignShell keys them. */
export type DotTab = "home" | "plan" | "measurements" | "training" | "nutrition" | "pictures" | "meetings" | "invoices";

export type DotTrail = {
  /** Tabs with something owed on them. */
  tabs: DotTab[];
  training: {
    /** Programme id → its screen weeks (1-based, as the week rail numbers them) with something owed: a video or photo to
     *  review, a note on a session to read, the live week with no sessions. */
    weeks: Record<number, number[]>;
    /** Sessions (program_day ids) with a video or photo to review or a note to read. */
    days: number[];
    /** Exercises (workout_assignment ids) with a video or photo waiting for review. */
    exercises: number[];
  };
  /** Food days (yyyy-mm-dd) with a note of theirs to read: the day → the notes' feed event ids, so opening the day marks
   *  them read (markSeenAction) and its dot goes. */
  food: Record<string, string[]>;
  /** A call they asked for, or a call over and not marked completed. */
  meetings: boolean;
  /** Locked out of signing in: App access on Home. */
  unlock: boolean;
  /** The to-do strip at the top of each tab (2 Nov, Alex: "if we just use dots, it can be a little bit confusing"): every
   *  thing the rail counts, on the tab it is done on, in the rail's order. */
  todo: TodoItem[];
};

/** One row of a tab's to-do strip (TodoStrip.tsx): what it is, since when it waits, and the action that does it. */
export type TodoItem = {
  /** The Needs-you id ("week", "complete-12", "read-…"), unique on one client. */
  key: string;
  tab: DotTab;
  kind: "setup" | "week" | "locked" | "video" | "ask-call" | "complete-call" | "read";
  /** "Week 5 has no sessions", "Video of Back Squat", "Check-In, 2/11, to complete". */
  what: string;
  /** The client's own words, in quotes after it. */
  words: string | null;
  /** Since when it waits (ms), for "2 days"; null for a standing state (an empty week: "this week"). */
  since: number | null;
  /** The action's word: Add sessions, Unlock, Review, Book, Mark completed, Read, New phase. */
  action: string;
  /** Where the action goes when the tab doesn't do it in place: its tab, at the thing (#session-…, #day-…, #call-…). */
  href: string;
  /** The thing's id where the tab acts in place: the call to complete, the call asked for. */
  ref: number | null;
  /** A note of theirs to read: its feed event, marked read the moment Read is clicked, on any tab. */
  eventId?: string | null;
  /** A track with nothing live (`track-…`): the track New phase opens on. */
  track?: "lifestyle" | "training" | "nutrition" | null;
};

export const NO_DOTS: DotTrail = { tabs: [], training: { weeks: {}, days: [], exercises: [] }, food: {}, meetings: false, unlock: false, todo: [] };

/** A week of this programme has a dot. */
export const weekDue = (dots: DotTrail | undefined, programId: number, weekIndex: number) => !!dots?.training.weeks[programId]?.includes(weekIndex);
