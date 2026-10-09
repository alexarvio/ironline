import type { NotifView } from "../../../client/notifications/NotificationsScreen";

// The client's Notifications screen in its states, from made-up data (9 Oct):
// nothing yet, a few new today, and a long feed over several days. Each is
// the real NotificationsScreen, so a change to it is a change here.

export type StateId = "empty" | "today" | "week";
export const STATES: { id: StateId; name: string; note: string }[] = [
  { id: "empty", name: "Nothing yet", note: "A new client: the bell with nothing behind it, and what will land here." },
  { id: "today", name: "New today", note: "Three unread this morning: a call booked, a video reply, a training change. Lifted cards, a dot each, \"3 new\" on the day." },
  { id: "week", name: "A week of it", note: "Today, yesterday and earlier days; read rows flat, one unread. Every category and colour." },
];

export const COACH = "Finlay";
const at = (day: string, time: string) => `${day}T${time}:00.000Z`;

export function notificationsProps(state: StateId): NotifView[] {
  if (state === "empty") return [];
  const today: NotifView[] = [
    { id: 1, category: "meeting_booked", eventType: null, title: "Finlay booked a call", body: "Phase review: into the bulk · Tue 13 Oct, 18:00", createdAt: at("2026-10-09", "09:12"), read: false, actionTab: "home", actionRef: null, videoReply: null },
    { id: 2, category: "video_reply", eventType: null, title: "Finlay replied to your squat video", body: "“Depth is good. Brace before you unrack and keep the bar over mid-foot.”", createdAt: at("2026-10-09", "08:40"), read: false, actionTab: "video", actionRef: null, videoReply: null },
    { id: 3, category: "training_changed", eventType: null, title: "Finlay updated your training", body: "Added Assisted Pull-Up in Session 1 (week 9)", createdAt: at("2026-10-09", "07:55"), read: false, actionTab: "training", actionRef: null, videoReply: null },
  ];
  if (state === "today") return today;
  return [
    ...today.map((n, i) => (i === 0 ? n : { ...n, read: true })),
    { id: 4, category: "event_added", eventType: "supplement", title: "Finlay added an event", body: "Start magnesium, 300 mg · from 13 Oct", createdAt: at("2026-10-08", "17:26"), read: true, actionTab: "home", actionRef: null, videoReply: null },
    { id: 5, category: "meeting_notes", eventType: null, title: "Finlay wrote up what you agreed on the call", body: "Hold calories at 2,900 on training days · push bench towards 100 kg", createdAt: at("2026-10-08", "12:03"), read: true, actionTab: "home", actionRef: null, videoReply: null },
    { id: 6, category: "checkin_comment", eventType: null, title: "Finlay changed what you check in", body: "Added Screen time · Added Happiness", createdAt: at("2026-10-07", "19:30"), read: true, actionTab: "home", actionRef: null, videoReply: null },
    { id: 7, category: "nutrition_changed", eventType: null, title: "Finlay updated your nutrition targets", body: "Protein on training days 180 → 190 g", createdAt: at("2026-10-07", "10:15"), read: true, actionTab: "nutrition", actionRef: null, videoReply: null },
    { id: 8, category: "pics_reviewed", eventType: null, title: "Finlay changed your progress pictures", body: "Now every two weeks · Added a side picture", createdAt: at("2026-10-05", "16:48"), read: true, actionTab: "home", actionRef: null, videoReply: null },
    { id: 9, category: "video_request", eventType: null, title: "Finlay asked you for a video", body: "Hack Squat in Push, week 8 · “Film the top set from the side, please.”", createdAt: at("2026-10-04", "09:02"), read: true, actionTab: "training", actionRef: null, videoReply: null },
    { id: 10, category: "invoice", eventType: null, title: "Finlay sent you invoice #0012", body: "October coaching · €180", createdAt: at("2026-10-01", "08:00"), read: true, actionTab: "invoices", actionRef: null, videoReply: null },
    { id: 11, category: "training_block", eventType: null, title: "Finlay published a new plan", body: "Strength block 2 · 6 weeks from 12 Oct", createdAt: at("2026-09-28", "18:20"), read: true, actionTab: "training", actionRef: null, videoReply: null },
  ];
}
