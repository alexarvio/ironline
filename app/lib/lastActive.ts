// When the client was last in the app, in words (4 Nov, Alex: as WhatsApp does, under the client's name in a chat's
// head, so the coach knows whether they are using the app). One way on the laptop's chat and the coach's phone:
// `Active now` (the last 5 minutes), `Active 12 min ago`, `Active 2 h ago` (under a day), `Active yesterday`, else the
// day as every admin fact line has it, `Active 3/11` (dayMonth, the year only when it isn't this one).

import { dayMonth } from "./dayMonth";

const MIN = 60 * 1000;

/** The words for a last-active time (ISO), or null when there is none. */
export function lastActiveWords(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const ago = Math.max(0, now - at);
  if (ago < 5 * MIN) return "Active now";
  if (ago < 60 * MIN) return `Active ${Math.floor(ago / MIN)} min ago`;
  if (ago < 24 * 60 * MIN) return `Active ${Math.floor(ago / (60 * MIN))} h ago`;
  const day = new Date(at);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.toDateString() === yesterday.toDateString()) return "Active yesterday";
  return `Active ${dayMonth(day)}`;
}
