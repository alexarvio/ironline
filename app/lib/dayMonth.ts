// A date in words, the coach admin's way (20 Oct, Alex): day/month numerals,
// "starts 9/11", "5/10 – 2/11", never "9 Nov" or "Mon 9 Nov"; the year only
// when it isn't this one ("9/11/2027"). Grids keep their month names (the
// timeline axes, the week rail, calendars); screen-reader labels keep words.

/** `9/11`, or `9/11/2027` in another year. Takes a yyyy-mm-dd day (read as that calendar day), a timestamp or a Date. */
export function dayMonth(d: string | Date): string {
  const x = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d) : d;
  return `${x.getDate()}/${x.getMonth() + 1}${x.getFullYear() !== new Date().getFullYear() ? `/${x.getFullYear()}` : ""}`;
}

/** `9/11, 14:05`: a moment, as a chat line or a saved stamp shows it. */
export function dayMonthTime(d: string | Date): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${dayMonth(x)}, ${x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}
