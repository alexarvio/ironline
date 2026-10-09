// The client's tabs by key, for the pages (server) and the shell (client)
// alike (9 Oct): the shell is a client module, so a helper the pages call
// cannot live there.
export const TAB_KEYS = ["home", "plan", "training", "nutrition", "measurements", "pictures", "meetings", "invoices"] as const;
export type PageTabKey = (typeof TAB_KEYS)[number];
export type RedesignTabKey = PageTabKey | "messages";

/** The tab a page should open on: ?tab= when it names one, else the page's own. */
export function tabFromParams(tab: string | undefined, fallback: RedesignTabKey): RedesignTabKey {
  return tab === "messages" || (TAB_KEYS as readonly string[]).includes(tab ?? "") ? (tab as RedesignTabKey) : fallback;
}
