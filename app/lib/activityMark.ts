// The kind a row of the coach's logs is (Home's and the Feed's Activity; 23 Oct, Alex: "add icons here to each type"),
// for the icon it wears in its colour (app/admin/redesign/KindMark.tsx): a track's own, a shape update the client app's
// rust camera, a call the Check-in call's blue, a message grey, an invoice its receipt, an event its type's, an account
// deleted a grey person. Plain data, so the server's loaders and the screens read it alike.

import { isEventTypeId, type EventTypeId } from "./eventTypes";

export type ActivityMark = "training" | "nutrition" | "lifestyle" | "shape" | "meetings" | "messages" | "invoices" | "account" | `event-${EventTypeId}`;

/** A row's mark, from its FeedEvent category and the tab it opens (a call that is over: category "meetings"). An event
    the client added wears its type's (a coach's own category, Other's); a note with no numbers (a check-in's, a
    programme's) is the client's words, so a message's grey. */
export function activityMarkOf(e: { category: string; tab: string; eventKind?: string | null; target?: { kind: string } }): ActivityMark {
  if (e.target?.kind === "gone") return "account";
  if (e.eventKind !== undefined) return `event-${isEventTypeId(e.eventKind) ? e.eventKind : "other"}`;
  if (e.category === "billing") return "invoices";
  if (e.category === "training") return "training";
  if (e.category === "nutrition") return "nutrition";
  if (e.tab === "photos") return "shape";
  if (e.category === "measurements") return "lifestyle";
  if (e.category === "meetings" || e.tab === "meetings") return "meetings";
  return "messages";
}
