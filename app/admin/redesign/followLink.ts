"use client";

import { TAB_KEYS } from "./tabs";

// A link inside the admin, followed without reloading the page (11 Nov, Alex: a message's link "reloaded itself, so the
// whole animation with the logo from the beginning appeared again"). A client's screens are one page with every tab in
// it, one showing (RedesignShell): on the screen the link names, its tab is brought forward first; then, with the same
// query, only its # changes and the tab's own listener opens the thing; with another week or programme the page moves
// under it and the # is arrived at the moment the new address is in. Another screen opens as any app link does and
// reads its # as it mounts.

type Router = { push: (href: string, options?: { scroll?: boolean }) => void };

/** The event RedesignShell listens for: bring this tab forward, the address left to the caller. */
export const SHOW_TAB_EVENT = "rd:show-tab";

/** True when a click should be left to the browser (a new tab or window, a download). */
export function leaveToBrowser(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/** A query as the screen reads it: the shell's own ?tab= and ?look= left out, the order no matter. */
function bare(search: string) {
  const p = new URLSearchParams(search);
  p.delete("tab");
  p.delete("look");
  p.sort();
  return p.toString();
}

const arriveAt = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
/** Two frames: the tab brought forward or the new week drawn before its listener measures and lands. */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

export function followLink(router: Router, href: string) {
  const to = new URL(href, window.location.origin);
  const here = window.location;
  const target = `${to.pathname}${to.search}${to.hash}`;
  if (to.pathname !== here.pathname) {
    // Another screen: it mounts on its own tab and reads its # itself.
    router.push(target, { scroll: false });
    return;
  }
  // The same screen, maybe with another of its tabs showing: the link's own tab comes forward.
  const routeTab = /^\/admin\/redesign\/([a-z]+)/.exec(to.pathname)?.[1];
  if (routeTab && (TAB_KEYS as readonly string[]).includes(routeTab)) window.dispatchEvent(new CustomEvent(SHOW_TAB_EVENT, { detail: routeTab }));
  if (bare(to.search) === bare(here.search)) {
    window.history.replaceState(null, "", target);
    if (to.hash) afterPaint(arriveAt);
    return;
  }
  router.push(target, { scroll: false });
  if (!to.hash) return;
  // The screen stays mounted under a new week or programme, so it is told once the new address (and with it the new
  // tree, committed together) is in, however long the server takes; going somewhere else meanwhile ends it.
  const want = bare(to.search);
  const started = performance.now();
  const wait = () => {
    if (window.location.pathname !== to.pathname) return;
    if (bare(window.location.search) === want) return afterPaint(arriveAt);
    if (performance.now() - started < 60000) requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}
