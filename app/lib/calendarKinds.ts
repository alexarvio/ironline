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
