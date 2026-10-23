import type { CSSProperties } from "react";
import type { ActivityMark } from "../../lib/activityMark";
import type { PhaseTrack } from "../../lib/db";
import { eventTypeOf } from "../../lib/eventTypes";
import { meetingTypeOf } from "../../lib/meetingTypes";
import { NOTIFICATION_TYPES } from "../../lib/notificationTypes";
import { TRACK_ACCENT } from "../phaseChrome";
import { TrackIcon } from "./plan/PlanDraft";

// A log row's kind as its icon in its colour (23 Oct, Alex: Home's Activity wears the Feed's): a track's own icon, a
// shape update the client app's rust camera, a call the Check-in call's video in its blue, a message the chat bubble
// grey, an invoice its receipt in ink, an event its type's icon and colour, an account deleted a grey person. The icon
// alone, no tile. Styles: .rd-kind (home/home.css, loaded on the Feed too).

const CALL = meetingTypeOf("checkin");
const SHAPE = NOTIFICATION_TYPES.pics_reviewed;
const CHAT_ICON = "M4 5h16v11H9l-5 4z";
const ACCOUNT_ICON = "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M16 11h6";

type Mark = { label: string; color: string; track?: PhaseTrack; path?: string };

export const MARKS: Record<Exclude<ActivityMark, `event-${string}`>, Mark> = {
  training: { label: "Training", color: TRACK_ACCENT.training, track: "training" },
  nutrition: { label: "Nutrition", color: TRACK_ACCENT.nutrition, track: "nutrition" },
  lifestyle: { label: "Lifestyle", color: TRACK_ACCENT.lifestyle, track: "lifestyle" },
  shape: { label: "Shape update", color: SHAPE.color, path: SHAPE.icon },
  meetings: { label: "Meetings", color: CALL.color, path: CALL.icon },
  messages: { label: "Message", color: "#5b6474", path: CHAT_ICON },
  invoices: { label: "Invoice", color: "#141a24", path: NOTIFICATION_TYPES.invoice.icon },
  account: { label: "Account", color: "#8b93a1", path: ACCOUNT_ICON },
};

const markOf = (mark: ActivityMark): Mark => {
  if (mark.startsWith("event-")) {
    const t = eventTypeOf(mark.slice("event-".length));
    return { label: t.label, color: t.color, path: t.icon };
  }
  return MARKS[mark as keyof typeof MARKS] ?? MARKS.messages;
};

export default function KindMark({ mark }: { mark: ActivityMark }) {
  const k = markOf(mark);
  return (
    <span className="rd-kind" style={{ "--c": k.color } as CSSProperties} title={k.label}>
      {k.track ? (
        <TrackIcon track={k.track} size={16} />
      ) : (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={k.path} />
        </svg>
      )}
      <span className="sr-only">{k.label}</span>
    </span>
  );
}
