import "server-only";

// How long each part of an admin screen's server render takes, with the live data (23 Oct, Alex: "insanely slow in
// the admin panel when I open a screen"), measured before anything is optimised. A page starts a timer, wraps each
// loader in t.time(label, fn) and hands what it returns through t.end(value): that render joins a ring buffer of the
// last 200 (the owner reads it at /api/timing) and logs one line, its parts slowest first:
//   [timing] home client=12 total=840ms rail=210 dots=95 home=180 training=240
// Measuring only: a wrapped call returns exactly what it would have (its value, its promise, its throw), and the
// timer itself never throws. The buffer lives on globalThis so the pages and the route share one, whatever bundles
// they are built into. Per server process: a restart or a deploy empties it.
//
// A loader's own parts (23 Oct): sub(label, fn) anywhere inside a t.time call records under the label it runs in,
// "home.board.strength", "training.trends", "rail.needsYou", without the timer passed down. While t.time runs its fn,
// that timer is the current one (the synchronous part: every loader is synchronous); outside one (a server action, a
// script) sub just runs fn. One thread: a synchronous call can't interleave with another request's, and an async
// continuation finds no current timer, so a part is never filed under another render.

export type TimingRender = {
  /** When the render ended, ISO. */
  at: string;
  screen: string;
  client: number | null;
  /** From the page function's start to its return, ms. */
  total: number;
  /** Each wrapped call, ms (one label timed twice adds up). */
  parts: Record<string, number>;
};

export type Timer = {
  /** Runs fn and records its ms under label; a promise is timed until it settles. Returns fn's result untouched. */
  time<T>(label: string, fn: () => T): T;
  /** The client the screen is about, once known. */
  client(id: number | null | undefined): void;
  /** Ends the render (once): records it and logs its line. Returns value untouched. */
  end<T>(value: T): T;
};

const MAX = 200;
/** The timed call running now: where a sub part is added, and the label path it sits under. */
type Scope = { add: (label: string, t0: number) => void; path: string };
const g = globalThis as unknown as { _ironlineTiming?: { renders: TimingRender[] }; _ironlineTimingScope?: Scope | null };
const store = () => (g._ironlineTiming ??= { renders: [] });

const clock = () => performance.now();
const tenth = (ms: number) => Math.round(ms * 10) / 10;

function isThenable(v: unknown): v is PromiseLike<unknown> {
  return v != null && (typeof v === "object" || typeof v === "function") && typeof (v as { then?: unknown }).then === "function";
}

export function startTiming(screen: string): Timer {
  const start = clock();
  const parts: Record<string, number> = {};
  let clientId: number | null = null;
  let ended = false;
  const add = (label: string, t0: number) => {
    try {
      parts[label] = (parts[label] ?? 0) + (clock() - t0);
    } catch {}
  };
  return {
    time<T>(label: string, fn: () => T): T {
      const t0 = clock();
      let out: T;
      const outer = g._ironlineTimingScope ?? null;
      g._ironlineTimingScope = { add, path: label };
      try {
        out = fn();
      } catch (e) {
        add(label, t0);
        throw e;
      } finally {
        g._ironlineTimingScope = outer;
      }
      if (isThenable(out)) {
        // A side chain, so the caller's promise is the same one; it handles a rejection, so nothing goes unhandled here.
        try {
          out.then(
            () => add(label, t0),
            () => add(label, t0),
          );
        } catch {}
      } else add(label, t0);
      return out;
    },
    client(id) {
      clientId = typeof id === "number" && Number.isFinite(id) ? id : null;
    },
    end<T>(value: T): T {
      if (ended) return value;
      ended = true;
      try {
        const total = tenth(clock() - start);
        const rounded: Record<string, number> = {};
        const order = Object.entries(parts).sort((a, b) => b[1] - a[1]);
        for (const [label, ms] of order) rounded[label] = tenth(ms);
        const render: TimingRender = { at: new Date().toISOString(), screen, client: clientId, total, parts: rounded };
        const list = store().renders;
        list.push(render);
        if (list.length > MAX) list.splice(0, list.length - MAX);
        const line = order.map(([label, ms]) => `${label}=${Math.round(ms)}`).join(" ");
        console.log(`[timing] ${screen}${clientId != null ? ` client=${clientId}` : ""} total=${Math.round(total)}ms${line ? ` ${line}` : ""}`);
      } catch {}
      return value;
    },
  };
}

/** Runs fn and, inside a t.time call, records its ms as "<outer label>.<label>"; outside one, just runs fn. Returns
    (or throws) exactly what fn does. Times the synchronous part: a promise's wait is not counted. */
export function sub<T>(label: string, fn: () => T): T {
  const scope = g._ironlineTimingScope;
  if (!scope) return fn();
  const path = `${scope.path}.${label}`;
  const t0 = clock();
  g._ironlineTimingScope = { add: scope.add, path };
  try {
    return fn();
  } finally {
    g._ironlineTimingScope = scope;
    scope.add(path, t0);
  }
}

/** One timed thing that is not a page render (25 Oct: an upload served), into the same buffer. Never throws. */
export function recordTiming(screen: string, total: number, parts: Record<string, number>) {
  try {
    const rounded: Record<string, number> = {};
    for (const [label, ms] of Object.entries(parts)) rounded[label] = tenth(ms);
    const list = store().renders;
    list.push({ at: new Date().toISOString(), screen, client: null, total: tenth(total), parts: rounded });
    if (list.length > MAX) list.splice(0, list.length - MAX);
  } catch {}
}

// ---- The report (/api/timing) ---------------------------------------------------------------------------------

export type TimingStat = { count: number; median: number; p90: number };

function stat(values: number[]): TimingStat {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return { count: 0, median: 0, p90: 0 };
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  const p90 = s[Math.min(n - 1, Math.ceil(n * 0.9) - 1)];
  return { count: n, median: tenth(median), p90: tenth(p90) };
}

/** Labels' stats, slowest median first. */
function statsByLabel(renders: TimingRender[]): Record<string, TimingStat> {
  const byLabel = new Map<string, number[]>();
  for (const r of renders)
    for (const [label, ms] of Object.entries(r.parts)) {
      const list = byLabel.get(label);
      if (list) list.push(ms);
      else byLabel.set(label, [ms]);
    }
  const rows = [...byLabel].map(([label, ms]) => [label, stat(ms)] as const).sort((a, b) => b[1].median - a[1].median);
  return Object.fromEntries(rows);
}

/** The buffer newest first, and per screen (its total, and each part within it) and per label: count, median, p90. */
export function timingReport() {
  const renders = [...store().renders].reverse();
  const byScreen = new Map<string, TimingRender[]>();
  for (const r of renders) {
    const list = byScreen.get(r.screen);
    if (list) list.push(r);
    else byScreen.set(r.screen, [r]);
  }
  const screens = Object.fromEntries(
    [...byScreen]
      .map(([screen, list]) => [screen, { ...stat(list.map((r) => r.total)), parts: statsByLabel(list) }] as const)
      .sort((a, b) => b[1].median - a[1].median),
  );
  return { now: new Date().toISOString(), kept: MAX, screens, labels: statsByLabel(renders), renders };
}
