// The client's notifications by what they are about (9 Oct): a category
// with a label, a colour, a badge icon and the action word on the right.
// Colours come from the event and meeting types, so a notification about
// a call is the call's blue and one about an event is that event's colour.
// Reminders (check-ins due, pictures due) are not notifications: they live
// on Home and go out as pushes, never into this list.

import { eventTypeOf, TRAINING_ICON, type EventTypeId } from "./eventTypes";

export type NotificationCategory =
  | "meeting_booked"
  | "meeting_changed"
  | "meeting_notes"
  | "focus"
  | "video_reply"
  | "video_request"
  | "training_block"
  | "training_changed"
  | "checkin_comment"
  | "event_added"
  | "event_changed"
  | "pics_reviewed"
  | "nutrition_phase"
  | "nutrition_changed"
  | "message"
  | "invoice"
  | "report"
  | "system";

export type NotificationType = { label: string; color: string; rgb: string; icon: string; action: string };

const ICON = {
  video: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5",
  play: "M8 5v14l11-7z",
  dumbbell: TRAINING_ICON,
  chat: "M4 5h16v11H9l-5 4z",
  notes: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  upload: "M12 16V5M7 10l5-5 5 5M5 19h14",
  camera: "M4 8h4l2-3h4l2 3h4v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  leaf: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7",
  // The apple the Nutrition tab uses (9 Oct), not a leaf.
  apple: "M15.5 8.5c2.8 0 4.5 2.4 4.5 5.5 0 4-2.7 7.5-5.5 7.5-1 0-1.5-.5-2.5-.5s-1.5.5-2.5.5c-2.8 0-5.5-3.5-5.5-7.5 0-3.1 1.9-5.5 4.7-5.5 1.3 0 2.1.6 3.3.6s1.9-.6 3.5-.6ZM12 8.5V6a2.2 2.2 0 0 1 2-2.2",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  // To focus on's goals as bullet points (23 Oct).
  list: "M10 6h10M10 12h10M10 18h10M5 6h.01M5 12h.01M5 18h.01",
};

const BLUE = { color: "#2f6fd6", rgb: "47,111,214" };
const INDIGO = { color: "#3a3390", rgb: "58,51,144" };
const AMBER = { color: "#a8761f", rgb: "168,118,31" };
/** Lifestyle's one beige (the check-in belongs to lifestyle). */
const BEIGE = { color: "#a08a5c", rgb: "160,138,92" };
const ORANGE = { color: "#b8471f", rgb: "184,71,31" };
const TEAL = { color: "#1d7a70", rgb: "29,122,112" };
const NAVY = { color: "#1d3466", rgb: "29,52,102" };
const SLATE = { color: "#5b6472", rgb: "91,100,114" };

export const NOTIFICATION_TYPES: Record<NotificationCategory, NotificationType> = {
  meeting_booked: { label: "Meeting", ...BLUE, icon: ICON.video, action: "View call" },
  meeting_changed: { label: "Meeting", ...BLUE, icon: ICON.video, action: "View call" },
  meeting_notes: { label: "Call notes", ...BLUE, icon: ICON.notes, action: "Read notes" },
  // Set at a call (23 Oct, Alex: it showed a bell, not the coach's face), so the call's blue.
  focus: { label: "To focus on", ...BLUE, icon: ICON.list, action: "See it" },
  video_reply: { label: "Video reply", ...INDIGO, icon: ICON.play, action: "Watch reply" },
  video_request: { label: "Video request", ...INDIGO, icon: ICON.upload, action: "Upload video" },
  training_block: { label: "Training", ...INDIGO, icon: ICON.dumbbell, action: "Preview block" },
  training_changed: { label: "Training", ...INDIGO, icon: ICON.dumbbell, action: "See training" },
  checkin_comment: { label: "Check-in", ...BEIGE, icon: ICON.chat, action: "Open check-in" },
  // Other's calendar, by name (20 Oct: by place, [5], it turned into Training's dumbbell when Family was added).
  event_added: { label: "Event", ...AMBER, icon: eventTypeOf("other").icon, action: "View event" },
  event_changed: { label: "Event", ...AMBER, icon: eventTypeOf("other").icon, action: "View event" },
  pics_reviewed: { label: "Shape update", ...ORANGE, icon: ICON.camera, action: "Open shape update" },
  nutrition_phase: { label: "Nutrition", ...TEAL, icon: ICON.apple, action: "See targets" },
  nutrition_changed: { label: "Nutrition", ...TEAL, icon: ICON.apple, action: "See targets" },
  message: { label: "Message", ...NAVY, icon: ICON.chat, action: "Reply" },
  invoice: { label: "Invoice", ...NAVY, icon: ICON.receipt, action: "View invoice" },
  report: { label: "Report", ...NAVY, icon: ICON.notes, action: "Read report" },
  system: { label: "Update", ...SLATE, icon: ICON.bell, action: "Open" },
};

/** The type for a notification; an event's takes its event type's colour and icon. */
export function notificationTypeOf(category: NotificationCategory, eventType: EventTypeId | null): NotificationType {
  const t = NOTIFICATION_TYPES[category];
  if ((category === "event_added" || category === "event_changed") && eventType) {
    const e = eventTypeOf(eventType);
    return { ...t, color: e.color, rgb: e.rgb, icon: e.icon };
  }
  return t;
}

/** A stored row, as the feed reads it. */
export type StoredNotification = { kind: string; message: string; action_tab: string | null };

/** Reminders are not notifications; chat messages have their own tab. */
export const isListed = (n: StoredNotification) => n.kind !== "reminder" && n.kind !== "coach_note";

const starts = (m: string, ...p: string[]) => p.some((x) => m.toLowerCase().startsWith(x.toLowerCase()));

/** The category of a stored row, from its kind, where it points and how it is worded. */
export function categorize(n: StoredNotification): NotificationCategory {
  const m = n.message;
  if (n.kind === "coach_note") return "message";
  if (n.kind === "report") return "report";
  if (n.action_tab === "video") return "video_reply";
  if (starts(m, "Asked you for a video")) return "video_request";
  if (starts(m, "Your coach wrote up what you agreed")) return "meeting_notes";
  if (starts(m, "Set what to focus on")) return "focus";
  if (starts(m, "Scheduled a meeting", "Scheduled ")) return "meeting_booked";
  if (starts(m, "Your call moved", "Moved your call", "Cancelled your call")) return "meeting_changed";
  if (starts(m, "Added to your calendar")) return "event_added";
  if (starts(m, "Your coach published a new plan", "Your coach set a new training phase")) return "training_block";
  if (starts(m, "Updated your training", "Added a week to your programme", "Left a note on your training")) return "training_changed";
  if (starts(m, "Your coach set new nutrition targets", "Your coach set a new nutrition phase")) return "nutrition_phase";
  if (starts(m, "Updated your nutrition", "Updated your supplements", "Updated your water goal", "Left a note on your nutrition")) return "nutrition_changed";
  // "progress pictures" is the feature's old name (21 Oct), still in rows written before.
  if (starts(m, "Changed your shape update", "Left instructions for your shape update", "Changed your progress pictures", "Left instructions for your progress pictures")) return "pics_reviewed";
  if (starts(m, "Changed what you check in", "Moved your weekly check-in day", "Moved your monthly check-in day", "Left a note on your check-in")) return "checkin_comment";
  if (starts(m, "Sent you invoice", "Sent a new invoice", "Marked invoice")) return "invoice";
  if (n.action_tab === "invoices") return "invoice";
  if (n.action_tab === "nutrition") return "nutrition_changed";
  if (n.action_tab === "training") return "training_changed";
  return "system";
}

/** The row's one line as a title and a body: "Updated your training: Week 3 …"
 *  reads as "Finlay updated your training" over "Week 3 …". A row that
 *  already names the coach ("Your coach replied…") keeps its shape with the
 *  name put in. */
export function titleAndBody(message: string, coachFirst: string): { title: string; body: string | null } {
  const i = message.indexOf(": ");
  let title = i > 0 ? message.slice(0, i) : message;
  const body = i > 0 ? message.slice(i + 2).trim() || null : null;
  if (/^your coach\b/i.test(title)) title = coachFirst + title.slice("your coach".length);
  else if (/^(scheduled|updated|added|changed|moved|left|set|sent|marked|cancelled|asked)\b/i.test(title)) title = `${coachFirst} ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
  return { title: title.replace(/\.$/, ""), body };
}
