// Which Calendar entries are about a client (23 Oct, Alex: "anything that is
// not training or client call should not have the possibility of linking a
// client to it"). A plain module, so the laptop's pop-up, the phone's sheet
// and the server all read the same rule.
//
// An entry's category is a preset id (CALENDAR_PRESETS in queries.ts: "call",
// "training", "admin", "personal", "content", "other") or a coach's own
// ("c12"). Rows from before categories have none, and they were all client
// calls (the Meetings tab's calls still have none).

/** A Client call or a Training session: the only entries that take a client. One with no category is a client call. */
export function takesClient(category: string | null | undefined): boolean {
  return category == null || category === "" || category === "call" || category === "training";
}

/** A call with the client: what their own screens show and count (their Meetings, Home, reminders), and the coach's Meetings tab. */
export function isClientCall(category: string | null | undefined): boolean {
  return category == null || category === "" || category === "call";
}

/** A call's link as typed, made one to open (25 Oct, Alex: the phone's Link row): trimmed, https:// put in front when
 *  no scheme is typed, only http(s) with a real host. Empty is none; anything else that isn't a link is null too, so
 *  the sheet holds Save back while it is typed and the server never stores it. */
export function callLink(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t || t.length > 500) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}
