"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { syncHealthStepsAction } from "../lib/actions";
import { callNative, nativeApp as cap, nativePlatform as platformOf } from "../lib/native";

// Steps from Apple Health (iPhone) or Health Connect (Android), read by the
// native app (mobile/, the @capgo/capacitor-health plugin) and saved into the
// client's daily "Steps" metric by syncHealthStepsAction. In a browser none of
// this exists: Settings shows the rows as "Soon", as before.

const noSubscribe = () => () => {};

// Whether this phone syncs, kept on the phone: iPhone never tells an app
// whether it may read (HealthKit hides a "no"), so the switch is ours.
const KEY = "ironline-health-steps";
const readOn = () => {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};
const writeOn = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(KEY, "on");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* blocked storage: syncs for this visit only */
  }
};

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// The last eight days (today and the seven a check-in can still change),
// one total per day in the phone's time.
async function syncSteps(): Promise<{ tracked: boolean; saved: number } | null> {
  if (!cap()) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  const res = await callNative<{ samples?: { startDate: string; value: number }[] }>("Health", "queryAggregated", {
    dataType: "steps",
    startDate: start.toISOString(),
    endDate: new Date().toISOString(),
    bucket: "day",
    aggregation: "sum",
  });
  const days = (res.samples ?? []).map((s) => ({ date: localDay(new Date(s.startDate)), steps: s.value }));
  return syncHealthStepsAction(days);
}

// Mounted once in the client app: syncs on opening and on coming back to the
// app, at most every ten minutes.
export function HealthAutoSync() {
  const router = useRouter();
  const last = useRef(0);
  useEffect(() => {
    if (!cap()) return;
    const run = () => {
      if (document.visibilityState !== "visible" || !readOn() || Date.now() - last.current < 10 * 60_000) return;
      last.current = Date.now();
      syncSteps()
        .then((r) => {
          if (r?.saved) router.refresh();
        })
        .catch(() => {});
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [router]);
  return null;
}

// Settings > Connected apps. In the app: one switch for this phone's health
// store. In a browser: both, marked Soon.
export function ConnectedApps({ coachName }: { coachName: string }) {
  const platform = useSyncExternalStore(noSubscribe, platformOf, () => null);
  const router = useRouter();
  const stored = useSyncExternalStore(noSubscribe, readOn, () => false);
  const [chosen, setOn] = useState<boolean | null>(null);
  const on = chosen ?? stored;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const sync = useCallback(async () => {
    const r = await syncSteps();
    if (r && !r.tracked) setNote(`${coachName} isn't tracking steps yet`);
    else setNote(null);
    if (r?.saved) router.refresh();
  }, [router, coachName]);

  // The names alone, Soon on their right; no line under the rows or the section (3 Nov, Alex: the words audit).
  if (!platform) {
    return (
      <section className="home-dark-section">
        <span className="home-dark-section-title">Connected apps</span>
        <div className="home-dark-rows">
          {["Apple Health", "Health Connect"].map((name) => (
            <div key={name} className="settings-app-row">
              <div className="home-dark-row-body">
                <div className="home-dark-row-title">{name}</div>
              </div>
              <span className="st-soon">Soon</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const name = platform === "ios" ? "Apple Health" : "Health Connect";
  const toggle = async () => {
    if (busy) return;
    if (on) {
      writeOn(false);
      setOn(false);
      setNote(null);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const avail = await callNative<{ available?: boolean }>("Health", "isAvailable");
      if (!avail.available) {
        setNote(platform === "android" ? "Health Connect not installed" : "Not on this phone");
        return;
      }
      const auth = await callNative<{ readAuthorized?: string[] }>("Health", "requestAuthorization", { read: ["steps"], write: [] });
      // Android says whether steps were allowed; iPhone never does.
      if (platform === "android" && !auth.readAuthorized?.includes("steps")) {
        setNote("Steps not allowed");
        return;
      }
      writeOn(true);
      setOn(true);
      await sync();
    } catch {
      setNote("Couldn't connect. Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="home-dark-section">
      <span className="home-dark-section-title">Connected apps</span>
      <div className="home-dark-rows">
        <button type="button" className="settings-toggle-row" onClick={toggle} disabled={busy}>
          <div className="home-dark-row-body">
            <div className="home-dark-row-title">{name}</div>
            <div className="home-dark-row-detail">Steps</div>
          </div>
          <span className={`settings-switch${on ? " on" : ""}`} aria-hidden="true">
            <span className="settings-switch-knob" />
          </span>
        </button>
      </div>
      {/* A note only when something went wrong (3 Nov, Alex: the words audit). */}
      {note && <div className="home-dark-empty st-note">{note}</div>}
    </section>
  );
}
