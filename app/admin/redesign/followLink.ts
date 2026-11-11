"use client";

// A link inside the admin, followed without reloading the page (11 Nov, Alex: a message's link "reloaded itself, so the
// whole animation with the logo from the beginning appeared again"). On the page showing, only its # changes and the
// tab's own listener opens the thing; on another week or tab of the same screen the page moves under it and the # is
// arrived at once the thing is drawn; another screen opens as any app link does and reads its # as it mounts.

type Router = { push: (href: string, options?: { scroll?: boolean }) => void };

/** True when a click should be left to the browser (a new tab or window, a download). */
export function leaveToBrowser(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/** The element a # points at, or what holds it (`#session-12-ex-4` is in `#session-12`). */
function targetOf(hash: string): Element | null {
  const id = hash.slice(1);
  return document.getElementById(id) ?? document.getElementById(id.replace(/-(ex|meal|row)-.*$/, ""));
}

export function followLink(router: Router, href: string) {
  const to = new URL(href, window.location.origin);
  const here = window.location;
  const samePage = to.pathname === here.pathname && to.search === here.search;
  if (samePage) {
    if (!to.hash) return;
    window.history.replaceState(null, "", `${to.pathname}${to.search}${to.hash}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  const sameScreen = to.pathname === here.pathname;
  router.push(`${to.pathname}${to.search}${to.hash}`, { scroll: false });
  // Another screen mounts and reads its # itself. The same screen stays mounted, so it is told once the new week or tab
  // is drawn (its element there), or after a moment at most.
  if (!sameScreen || !to.hash) return;
  const started = performance.now();
  const wait = () => {
    const arrived = window.location.search === to.search;
    if (arrived && (targetOf(to.hash) || performance.now() - started > 2500)) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    }
    if (performance.now() - started < 6000) requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}
