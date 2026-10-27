"use client";

import { useMemo } from "react";
import { saveCoachNotifyAction, saveCoachPreferencesAction } from "../../../lib/actions";
import type { CoachNotify } from "../../../lib/db";
import Picker from "../Picker";
import { useSaveSlot } from "./SaveHost";
import { Field, Section, useDraft } from "./SettingsForms";

// Settings' three sections added on 27 Oct (Alex: mockup B, "you can work on the whole settings"): Notifications (what
// reaches the coach's phone, and quiet hours), Preferences (kg or lbs by default, the time zone) and Your data (the
// export). Each saves on the page's one bar, as the others do; Your data has nothing to save, only its download.

/** On or off, white while off and ink while on (design rules: anything on/off). */
function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`rst-switch${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <i aria-hidden="true" />
    </button>
  );
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---- Notifications
export function NotificationsSettings({ initial }: { initial: CoachNotify }) {
  const start = { chat: initial.chat !== false, video: initial.video !== false, quiet: !!initial.quiet, quietFrom: initial.quietFrom ?? "22:00", quietTo: initial.quietTo ?? "07:00" };
  const d = useDraft(start, (v) => saveCoachNotifyAction(v));
  const timesBad = !HHMM.test(d.v.quietFrom) || !HHMM.test(d.v.quietTo);
  useSaveSlot("notifications", { dirty: d.dirty, count: d.count, blocked: timesBad, problem: timesBad ? "Quiet hours in Notifications need two times, like 22:00" : null, save: d.commit, cancel: d.discard });
  const row = (key: "chat" | "video", name: string) => (
    <div className="rst-row">
      <span className="rst-row-main">
        <b>{name}</b>
      </span>
      <Switch on={d.v[key]} label={name} onChange={(on) => d.set(key, on)} />
    </div>
  );
  const time = (key: "quietFrom" | "quietTo", label: string) => (
    <input className="dlh-line rst-time" inputMode="numeric" maxLength={5} value={d.v[key]} onChange={(e) => d.set(key, e.target.value.replace(/[^\d:]/g, ""))} aria-label={label} aria-invalid={!HHMM.test(d.v[key])} />
  );
  return (
    <>
      <Section title="To your phone">
        <div className="rls-card rst-card">
          <div className="rst-rows">
            {row("chat", "Messages from clients")}
            {row("video", "Videos to review")}
          </div>
        </div>
      </Section>
      <Section title="Quiet hours">
        <div className="rls-card rst-card">
          <div className="rst-rows">
            <div className="rst-row">
              <span className="rst-row-main rst-quiet">
                <b>Hold notifications</b>
                {time("quietFrom", "From")}
                <small>to</small>
                {time("quietTo", "To")}
              </span>
              <Switch on={d.v.quiet} label="Quiet hours" onChange={(on) => d.set("quiet", on)} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

// ---- Preferences
export function PreferencesSettings({ units, timezone }: { units: "kg" | "lbs"; timezone: string }) {
  const d = useDraft({ units, timezone }, (v) => saveCoachPreferencesAction(v));
  useSaveSlot("preferences", { dirty: d.dirty, count: d.count, save: d.commit, cancel: d.discard });
  // Every time zone the browser knows, its city as the label (Europe/Amsterdam → Amsterdam, Europe).
  const zones = useMemo(() => {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [timezone];
    const list = all.includes(timezone) ? all : [timezone, ...all];
    return list.map((z) => {
      const [region, ...rest] = z.split("/");
      return { value: z, label: rest.length ? `${rest.join(" / ").replace(/_/g, " ")}` : z, hint: rest.length ? region : undefined };
    });
  }, [timezone]);
  return (
    <>
      <Section title="Weights">
        <div className="rls-card rst-card">
          <div className="rst-grid">
            <Field label="Show weights in" group>
              <div className="rd-btn-group rst-cap" role="radiogroup" aria-label="Show weights in">
                {(["kg", "lbs"] as const).map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={d.v.units === u} className={d.v.units === u ? "on" : ""} onClick={() => d.set("units", u)}>
                    {u}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Section>
      <Section title="Time zone">
        <div className="rls-card rst-card">
          <div className="rst-grid">
            <Field label="Your time zone" group>
              <Picker value={d.v.timezone} onChange={(v) => d.set("timezone", v)} label="Time zone" className="rst-pick" options={zones} />
            </Field>
          </div>
        </div>
      </Section>
    </>
  );
}

// ---- Your data
export function DataSettings({ clients }: { clients: number }) {
  return (
    <Section title="Export">
      <div className="rls-card rst-card">
        <div className="rst-rows">
          <div className="rst-row">
            <span className="rst-row-main">
              <b>Everything</b>
              <small>
                {clients} {clients === 1 ? "client" : "clients"} | programmes, logs, check-ins, food, calls, invoices | one file
              </small>
            </span>
            <a className="trn-pill rst-pill" href="/api/export" download>
              Export
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
