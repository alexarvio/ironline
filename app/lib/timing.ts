import "server-only";
import fs from "fs";

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

// ---- Memory (/api/timing, 4 Nov, Alex: memory is 92% of the Railway bill, the app spikes to 2-8 GB for hours) ---
// What the process holds now, its peak since it started, and on Linux the container's own count, the figure Railway
// bills, split into anon (the app's own memory) and file (page cache the kernel can drop). Everything in MB, read
// safely: a file that isn't there (Windows, macOS, no cgroup) is null, never a throw. The peak is sampled every 30 s
// on a timer that never keeps the process alive (unref), started the first time this module loads (the root layout
// imports it), on globalThis so a second bundle of this module shares the one sampler.

const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;

type RssPeak = { mb: number; at: string; since: string };
const gm = globalThis as unknown as { _ironlineRssPeak?: RssPeak; _ironlineRssTimer?: ReturnType<typeof setInterval> };

function sampleRss() {
  try {
    const now = mb(process.memoryUsage.rss());
    const peak = (gm._ironlineRssPeak ??= { mb: 0, at: new Date().toISOString(), since: new Date().toISOString() });
    if (now > peak.mb) {
      peak.mb = now;
      peak.at = new Date().toISOString();
    }
  } catch {}
}

try {
  if (!gm._ironlineRssTimer) {
    sampleRss();
    const timer = setInterval(sampleRss, 30_000);
    timer.unref?.();
    gm._ironlineRssTimer = timer;
  }
} catch {}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** A file holding one byte count ("max" or missing reads null). */
function readBytes(file: string): number | null {
  const text = readText(file)?.trim();
  if (!text || !/^\d+$/.test(text)) return null;
  return mb(Number(text));
}

/** memory.stat's "key value" lines, the keys asked for, in MB (a key not there is null). */
function readStat(file: string, keys: string[]): Record<string, number | null> | null {
  const text = readText(file);
  if (text == null) return null;
  const all = new Map<string, number>();
  for (const line of text.split("\n")) {
    const [k, v] = line.trim().split(/\s+/);
    if (k && v && /^\d+$/.test(v)) all.set(k, Number(v));
  }
  return Object.fromEntries(keys.map((k) => [k, all.has(k) ? mb(all.get(k)!) : null]));
}

/** The container's memory: cgroup v2 first (Railway), else v1; null when neither is there. */
function containerMemory() {
  try {
    const current = readBytes("/sys/fs/cgroup/memory.current");
    if (current != null) {
      const stat = readStat("/sys/fs/cgroup/memory.stat", ["anon", "file", "kernel", "shmem", "sock"]);
      return {
        cgroup: "v2",
        currentMb: current,
        peakMb: readBytes("/sys/fs/cgroup/memory.peak"),
        limitMb: readBytes("/sys/fs/cgroup/memory.max"),
        anonMb: stat?.anon ?? null,
        fileMb: stat?.file ?? null,
        kernelMb: stat?.kernel ?? null,
        shmemMb: stat?.shmem ?? null,
        sockMb: stat?.sock ?? null,
      };
    }
    const v1 = readBytes("/sys/fs/cgroup/memory/memory.usage_in_bytes");
    if (v1 != null) {
      const stat = readStat("/sys/fs/cgroup/memory/memory.stat", ["total_rss", "total_cache", "rss", "cache"]);
      return {
        cgroup: "v1",
        currentMb: v1,
        peakMb: readBytes("/sys/fs/cgroup/memory/memory.max_usage_in_bytes"),
        limitMb: readBytes("/sys/fs/cgroup/memory/memory.limit_in_bytes"),
        anonMb: stat?.total_rss ?? stat?.rss ?? null,
        fileMb: stat?.total_cache ?? stat?.cache ?? null,
        kernelMb: null,
        shmemMb: null,
        sockMb: null,
      };
    }
  } catch {}
  return null;
}

/** This process's memory now and at its peak, and the container's. Never throws. */
export function memoryReport() {
  try {
    sampleRss();
    const m = process.memoryUsage();
    let maxRssMb: number | null = null;
    try {
      // The OS's own high-water mark for this process, in KB (Linux and macOS; Windows reports its peak working set).
      maxRssMb = mb(process.resourceUsage().maxRSS * 1024);
    } catch {}
    return {
      pid: process.pid,
      uptimeS: Math.round(process.uptime()),
      process: {
        rssMb: mb(m.rss),
        heapTotalMb: mb(m.heapTotal),
        heapUsedMb: mb(m.heapUsed),
        externalMb: mb(m.external),
        arrayBuffersMb: mb(m.arrayBuffers),
      },
      peak: { sampledRssMb: gm._ironlineRssPeak?.mb ?? null, sampledAt: gm._ironlineRssPeak?.at ?? null, sampledSince: gm._ironlineRssPeak?.since ?? null, maxRssMb },
      container: containerMemory(),
    };
  } catch {
    return null;
  }
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
