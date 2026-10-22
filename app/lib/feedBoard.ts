// The coach's Feed (21 Oct, Alex: built from the Feed mockup): every client at once, clear at a glance. What happened
// since the coach last looked, Needs you (one task a row, each with its action), Clients (a row a client: their last
// 14 days, this week's sessions, when they were last active, at most two state pills), and Activity (a log, one line
// a row, the newest first, New over Earlier). Money lives on Business, so no invoices here.
// One read: getFeedBoard (feedBoardData.ts). Dates yyyy-mm-dd; moments ISO strings.

/** A task for the coach, one a row (not one a client). */
export type NeedRow = {
  /** Stable and unique across clients: "<clientId>:<HomeAction id>", or "<clientId>:meeting-<meetingId>" for a call today
      (a HomeAction id like "week" repeats from client to client, and "call-<id>" is already a call they asked for). */
  key: string;
  clientId: number;
  client: string;
  avatarPath: string | null;
  /** What it is: an empty week in the live programme, a locked-out login, messages or a video waiting for a reply, a
      call they asked for, a call today, a note of theirs to read (a session they couldn't do). */
  kind: "week" | "locked" | "reply" | "video" | "ask-call" | "call" | "read";
  /** "Week 8 has no sessions", "2 messages", "Video of Back Squat", "Check-in call", "Couldn't do Session 3". */
  what: string;
  /** The client's own words, shown in quotes after it, when there are some. */
  words: string | null;
  /** Since when it waits (ISO), for "2 days"; null for a standing state (the empty week) or a call today. */
  since: string | null;
  /** A call today: its time, "10:00". */
  time: string | null;
  /** The pill's word: Add sessions, Unlock, Reply, Review, Book, Prep, Read. */
  action: string;
  /** Where the row and its pill go (the same place). */
  href: string;
  /** The HomeAction id ⋯ Done clears with (dismissHomeActionAction); null when it can't be dismissed (a call today). */
  dismissId: string | null;
};


export type ActivityKind = "training" | "nutrition" | "lifestyle" | "meetings" | "messages";

/** One line of the log: the date and time, the client, the kind's icon, the thing and the rest of it in grey. */
export type ActivityRow = {
  /** The FeedEvent's id. */
  id: string;
  clientId: number;
  client: string;
  kind: ActivityKind;
  /** ISO moment. */
  at: string;
  /** False when only the day is known (older check-ins): no time shown. */
  timeKnown: boolean;
  /** "Session 2", "Daily check-in", "Food", "Shape update". */
  title: string;
  /** The rest, parted on screen with Sep: "Week 2", "22 sets". */
  rest: string[];
  /** The client's own words, in quotes after the rest. */
  quote: string | null;
  /** Where it opens (feedHref). */
  href: string;
  /** Since the coach's previous look: under New. */
  isNew: boolean;
};

export type FeedBoard = {
  today: string;
  /** Since the coach's previous visit to the Feed (feed_looked.prev; 30 minutes apart is a new visit), across every
      client: sessions done, check-ins, food days, messages from clients, shape updates sent. Null on a first visit or
      when nothing happened; zeros left out on screen. */
  since: { from: string; sessions: number; checkIns: number; foodDays: number; messages: number; shapeUpdates: number } | null;
  /** Blockers first (an empty week, a lockout), then today's calls by time, then the longest wait. */
  needs: NeedRow[];
  /** Newest first: each kind's newest 200. */
  activity: ActivityRow[];
};

export { getFeedBoard, noteFeedLooked } from "./feedBoardData";
