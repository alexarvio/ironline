// What a coach owes, read once a page (4 Nov, Alex: "just a tiny bit slow" going Phases → Calendar → Feed → Business):
// the rail (loadRail), the Feed (feedBoardData's context), the Phases screen's Needs you (loadPhaseNeeds) and one
// client's dot trail (loadDots) each built the coach's whole activity feed and every client's getClientHome again. Now
// one read a request: React's cache() holds it through a page render (a server action's body gets none, so an action
// and the page drawn after it each read afresh; app/lib/auth.ts). Nothing here is changed by its readers: they filter
// and walk the lists, never sort or edit them in place.

import { cache } from "react";
import { getActivityFeed, getClientHome, listClients, trainingIndex, type FeedEvent, type HomeAction } from "./queries";
import { sub } from "./timing";

export type CoachNeeds = {
  /** Everything the coach's clients logged, newest first (getActivityFeed). */
  feed: FeedEvent[];
  byId: Map<string, FeedEvent>;
  /** Each client's open Needs-you items as their Home spells them, or what getClientHome threw for them (handed on to
   *  whoever asks, so the rail still fails as it did and the Feed still reads one client's as empty). */
  homes: Map<number, { actions: HomeAction[] } | { error: unknown }>;
};

/** The coach's feed and every client's Needs you, once a request. Timed under the caller that reads it first
 *  (`rail.feed`, `rail.needsYou`; `feedBoard.…` on the Feed, which reads before its rail). */
export const coachNeeds = cache((coachId: number): CoachNeeds => {
  const feed = sub("feed", () => getActivityFeed(coachId));
  const byId = new Map(feed.map((e) => [e.id, e] as const));
  const homes = sub("needsYou", () => {
    const list = listClients(coachId);
    // Each client's own events and every client's training rows, read once for them all (23 Oct, speed: every client's
    // Needs you walked the whole feed and scanned the store per session); getClientHome reads the same rows either way.
    const feedOf = new Map<number, FeedEvent[]>(list.map((c) => [c.id, []]));
    for (const e of feed) feedOf.get(e.clientId)?.push(e);
    const ix = trainingIndex(list.map((c) => c.id));
    const out: CoachNeeds["homes"] = new Map();
    for (const c of list) {
      try {
        out.set(c.id, { actions: getClientHome(c.id, feedOf.get(c.id) ?? [], ix).actions });
      } catch (error) {
        out.set(c.id, { error });
      }
    }
    return out;
  });
  return { feed, byId, homes };
});

/** One client's Needs-you items from the coach's read; a client outside it (not the coach's) read on its own, as before. */
export function clientActions(coachId: number, clientId: number): HomeAction[] {
  const needs = coachNeeds(coachId);
  const home = needs.homes.get(clientId);
  if (!home) return getClientHome(clientId, needs.feed).actions;
  if ("error" in home) throw home.error;
  return home.actions;
}
