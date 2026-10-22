// The dot trail (22 Oct, Alex): what the coach owes a client, marked with a rust dot at each step down to it, so the
// rail's number leads somewhere: the client's tab, then on Training the week, then the session, then the exercise (its
// video mark, rust while it waits). The same things the rail counts (the Feed's Needs you), worked out once on the
// server (loadDots in loaders.ts) and handed to every tab. A dot goes when the thing is done (replied, reviewed, read,
// booked), never just by looking. The chat keeps its own dot on the chat tab (unread, gone on opening). Styles: .rd-due
// in training/draft.css.

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
  /** A call they asked for, or a call today. */
  meetings: boolean;
  /** Locked out of signing in: App access on Home. */
  unlock: boolean;
};

export const NO_DOTS: DotTrail = { tabs: [], training: { weeks: {}, days: [], exercises: [] }, food: {}, meetings: false, unlock: false };

/** A week of this programme has a dot. */
export const weekDue = (dots: DotTrail | undefined, programId: number, weekIndex: number) => !!dots?.training.weeks[programId]?.includes(weekIndex);
