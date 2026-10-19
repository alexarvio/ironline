"use client";

import { useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { MonthRange } from "../plan/PlanDraft";
import { phaseChrome } from "../../phaseChrome";
import { addDays, mondayOf } from "../phases/timeline";

// Scheduling a built programme (20 Oct, Alex): not its dates, which it
// already has, but when it goes live. The coach picks the week it starts
// (training runs Monday to Sunday) and the time on that Monday; the length
// stays what was built. Drawn in the phase pop-up's hairline style (npd).

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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
    <DialogContent className="npd sch">
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
          <div className="npd-field">
            <span className="npd-label">Goes live</span>
            <span className="sch-when">{day(start)}</span>
          </div>
          <label className="npd-field">
            <span className="npd-label">At</span>
            <input className="npd-line sch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time it goes live" />
          </label>
          {clash && (
            <p className="npd-note bad" role="alert">
              Overlaps {clash.name}, {short(clash.from)} – {short(clash.to)}.
            </p>
          )}
          {past && !clash && (
            <p className="npd-note bad" role="alert">
              That week has passed.
            </p>
          )}
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
