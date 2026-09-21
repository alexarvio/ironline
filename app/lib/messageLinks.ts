// A coach message can point at one thing in the client's app — a session, an
// exercise in it, a day of their food diary, the check-in, their progress
// pictures — and the client taps through to it from the message. Optional:
// most messages point at nothing.
//
// Shared by the server (which stores and checks links) and both apps (which
// show and open them), so nothing in here may touch the data.

export type MessageLink =
  | { kind: "session"; dayId: number }
  | { kind: "exercise"; dayId: number; assignmentId: number }
  | { kind: "nutrition" }
  // A day of the food diary, or one meal on it (FoodEntry.meal's key) when
  // the coach commented on that meal or its picture.
  | { kind: "food"; date: string; meal?: string }
  | { kind: "checkin"; section: "daily" | "weekly"; period?: string }
  | { kind: "photos"; period?: string };

export type LinkArea = "Training" | "Nutrition" | "Measurements";

/** A link as it is shown: where it goes, in words, and whether it still can. */
export type LinkView = {
  link: MessageLink;
  area: LinkArea;
  /** "Leg Press · Lower, Week 4" */
  label: string;
  /** A training link's week (the programme's week number), so the week strip lands on it. */
  week: number | null;
  /** It can't be opened any more: the session or exercise was deleted, or the programme it was in has ended. */
  gone: boolean;
};

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
const day = (v: unknown) => (typeof v === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v) ? v : null);

/** A link from outside (a form, stored data), checked for shape. Null when it is not one. */
export function parseMessageLink(raw: unknown): MessageLink | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "session": {
      const dayId = int(r.dayId);
      return dayId ? { kind: "session", dayId } : null;
    }
    case "exercise": {
      const dayId = int(r.dayId);
      const assignmentId = int(r.assignmentId);
      return dayId && assignmentId ? { kind: "exercise", dayId, assignmentId } : null;
    }
    case "nutrition":
      return { kind: "nutrition" };
    case "food": {
      const date = day(r.date);
      if (!date) return null;
      const meal = typeof r.meal === "string" && /^([a-z]{1,20}|m:[0-9]{1,12})$/.test(r.meal) ? r.meal : null;
      return meal ? { kind: "food", date, meal } : { kind: "food", date };
    }
    case "checkin": {
      if (r.section !== "daily" && r.section !== "weekly") return null;
      const period = day(r.period);
      return period ? { kind: "checkin", section: r.section, period } : { kind: "checkin", section: r.section };
    }
    case "photos": {
      const period = day(r.period);
      return period ? { kind: "photos", period } : { kind: "photos" };
    }
    default:
      return null;
  }
}

/** Two links point at the same thing. */
export const sameLink = (a: MessageLink | null, b: MessageLink | null) => JSON.stringify(a) === JSON.stringify(b);
