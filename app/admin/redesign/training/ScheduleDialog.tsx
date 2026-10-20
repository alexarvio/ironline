"use client";

import { useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { MonthRange } from "../plan/PlanDraft";
import type React from "react";
import { phaseChrome, TRACK_PALETTE } from "../../phaseChrome";
import { addDays, mondayOf } from "../phases/timeline";
import DateText from "../DateText";

// Scheduling a built programme (20 Oct, Alex): not its dates, which it
// already has, but when it goes live. The coach picks the week it starts
// (training runs Monday to Sunday) and the time on that Monday; the length
// stays what was built. Drawn in the phase pop-up's hairline style (npd).

/** Day/month, as every date in words (20 Oct, Alex). */
const short = (iso: string) => {
  const x = new Date(`${iso}T00:00:00`);
  return `${x.getDate()}/${x.getMonth() + 1}${x.getFullYear() !== new Date().getFullYear() ? `/${x.getFullYear()}` : ""}`;
};

export default function ScheduleDialog({
  name,
  weeks,
  start: initialStart,
  today,
  others,
  onSchedule,
  onClose,
}: {
  name: string;
  weeks: number;
  /** The Monday it starts on now, if it has one. */
  start: string | null;
  today: string;
  /** The client's other training phases, so a clash shows. */
  others: { name: string; from: string; to: string }[];
  /** start: the Monday its first week begins; end: the Monday its last week begins (the phase's stored end). */
  onSchedule: (v: { start: string; end: string; time: string }) => void;
  onClose: () => void;
}) {
  const nextMonday = mondayOf(addDays(today, 7));
  const [start, setStart] = useState(initialStart && initialStart > today ? mondayOf(initialStart) : nextMonday);
  const [time, setTime] = useState("09:00");
  const [cursor, setCursor] = useState(start.slice(0, 7));
  const lastMonday = addDays(start, (Math.max(1, weeks) - 1) * 7);
  const end = addDays(lastMonday, 6);
  const clash = others.find((o) => o.from <= end && o.to >= start) ?? null;
  const past = start < mondayOf(today);
  const ok = !clash && !past && /^\d{2}:\d{2}$/.test(time);

  return (
    <DialogContent className="npd sch" style={{ "--npd-c": TRACK_PALETTE.training.ink, "--npd-rgb": "58, 51, 144" } as React.CSSProperties}>
      <div className="npd-head">
        <div>
          <DialogTitle className="npd-title">Schedule {name}</DialogTitle>
          <DialogDescription className="npd-meta">
            {weeks} {weeks === 1 ? "week" : "weeks"} · {short(start)} – {short(end)}
          </DialogDescription>
        </div>
        <button type="button" className="npd-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="npd-cols">
        <MonthRange
          from={start}
          to={end}
          onPick={(d) => {
            const m = mondayOf(d);
            setStart(m);
            setCursor(m.slice(0, 7));
          }}
          chrome={phaseChrome("training", "scheduled")}
          planned={others}
          cursor={cursor}
          setCursor={setCursor}
          today={today}
          plain
        />
        <div className="npd-side">
          {/* Typed or picked, as every date (20 Oct, Alex); a typed day lands on its week's Monday. */}
          <div className="npd-dates">
            <div className="npd-date arm">
              <span className="npd-date-head">Goes live</span>
              <DateText
                value={start}
                onChange={(d) => {
                  const m = mondayOf(d);
                  setStart(m);
                  setCursor(m.slice(0, 7));
                }}
                label="Week it goes live"
              />
            </div>
          </div>
          <label className="npd-field">
            <span className="npd-label">At</span>
            <input className="npd-line sch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time it goes live" />
          </label>
          {/* Always there, so the pop-up keeps its height whether or not something is wrong. */}
          <p className={`npd-note${clash || past ? " bad" : ""}`} role={clash || past ? "alert" : undefined}>
            <span>{clash ? `Overlaps ${clash.name}, ${short(clash.from)} – ${short(clash.to)}.` : past ? "That week has passed." : " "}</span>
          </p>
        </div>
      </div>
      <div className="npd-foot">
        <button type="button" className="npd-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="npd-save" disabled={!ok} onClick={() => onSchedule({ start, end: lastMonday, time })}>
          Schedule it
        </button>
      </div>
    </DialogContent>
  );
}
