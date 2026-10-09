// Day labels and times for the notifications list (9 Oct), in the phone's
// own calendar: TODAY, YESTERDAY, then "WED 7 OCT" for the last week, then
// "7 OCT" (with the year when it isn't this one).

const DAY = 86400000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** yyyy-mm-dd in local time. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dayNum = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / DAY;

export function dayLabel(key: string, todayKey: string): string {
  const back = Math.round(dayNum(todayKey) - dayNum(key));
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const d = new Date(`${key}T12:00:00`);
  const dm = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (back < 7) return `${DAYS[d.getDay()]} ${dm}`;
  return key.slice(0, 4) === todayKey.slice(0, 4) ? dm : `${dm} ${key.slice(0, 4)}`;
}

/** "5:26 PM", the phone's own style: the day header already says the date (9 Oct). */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
