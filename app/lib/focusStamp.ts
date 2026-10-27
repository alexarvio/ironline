// To focus on, open or folded, kept in a cookie (27 Oct, Alex: "the deployment is not smooth"): the page is drawn as the
// client left it, so it never snaps open after loading. New goals arrive open once. Shared by the page (server) and
// FocusList (the phone); nothing here reads the store.

export const FOCUS_COOKIE = "norcoach_focus";

/** What the goals are, short: a new list (or a word changed) is a new stamp. */
export function focusStamp(goals: { id: number | string; text: string }[]): string {
  let h = 5381;
  for (const g of goals) for (const ch of `${g.id}:${g.text}|`) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** Open, as the cookie says for these goals; goals not seen yet open. */
export function focusOpenFrom(cookie: string | null | undefined, stamp: string): boolean {
  if (!cookie) return true;
  const [seen, open] = cookie.split(":");
  return seen !== stamp ? true : open === "1";
}
