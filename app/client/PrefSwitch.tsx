"use client";

import { useOptimistic, useTransition } from "react";
import { setClientPreferenceAction } from "../lib/actions";

// One of Settings' Preferences switches (Messages from {Coach}, Check-in
// reminders), kept on the client's preferences. It moves the moment it is
// tapped (12 Nov, Alex: a switch there seemed to do nothing while the whole
// page came back from the server) and settles on what the server saved.
export default function PrefSwitch({ clientId, prefKey, label, on }: { clientId: number; prefKey: "coach_notes" | "checkin_reminders"; label: string; on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [, start] = useTransition();

  function toggle() {
    const next = !shown;
    start(async () => {
      setShown(next);
      const form = new FormData();
      form.set("clientId", String(clientId));
      form.set("key", prefKey);
      form.set("value", String(next));
      await setClientPreferenceAction(form);
    });
  }

  return (
    <button type="button" className="settings-toggle-row" onClick={toggle} aria-pressed={shown}>
      <div className="home-dark-row-body">
        <div className="home-dark-row-title">{label}</div>
      </div>
      <span className={`settings-switch${shown ? " on" : ""}`} aria-hidden="true">
        <span className="settings-switch-knob" />
      </span>
    </button>
  );
}
