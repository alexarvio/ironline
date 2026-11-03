"use client";

import { useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DialogClose, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { WeightGoalIcon } from "../../components/icons";
import { deleteWeightGoalAction, saveWeightGoalAction } from "../../lib/actions";
import { dayMonth } from "../../lib/dayMonth";
import { daysBetween, kgFrom, kgIn, VERDICT_TONE, VERDICT_WORD, type WeightGoalView } from "../../lib/weightGoal";
import DatePick from "./DatePick";
import { SepJoin } from "./Sep";

// A weight goal's pop-up (2 Nov, Alex), the one way to set or change one: from Home's Weight card and from the Plan's
// Weight lane alike. The .dlh card: its title, the goal's tag and verdict, Goal and By on clean lines, one live fact.
// Delete in red words asks first. No `Added by` (2 Nov, Alex: only the coach sets one) and no Now | Plan | To go figures.

const REFUSED: Record<string, string> = {
  "no-weight": "No weigh-in yet.",
  "too-soon": "At least a week from its start.",
  taken: "A goal on that day already.",
  invalid: "Check the weight and the date.",
  running: "A goal is already running.",
};

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const one = (v: number) => String(Math.round(v * 10) / 10);

export default function WeightGoalDialog({
  clientId,
  goal,
  unit = "kg",
  nowKg,
  initialBy,
  onDone,
}: {
  clientId: number;
  /** The goal to change; none for a new one. */
  goal: WeightGoalView | null;
  /** The coach's unit. */
  unit?: "kg" | "lbs";
  /** The client's latest weigh-in, kg: where a new goal starts (3 Nov, Alex). */
  nowKg: number | null;
  /** A new goal's date to start from (a week clicked on the Plan). */
  initialBy?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [weight, setWeight] = useState(goal ? one(kgIn(goal.targetKg, unit)) : "");
  const [by, setBy] = useState(goal?.byDate ?? initialBy ?? "");
  const [refused, setRefused] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const today = isoOf(new Date());
  const typed = Number(weight.replace(",", "."));
  // The field shows a goal to one decimal; left as shown, the stored weight stays exactly as it was (82.25 stays 82.25).
  const shownBefore = goal ? one(kgIn(goal.targetKg, unit)) : null;
  const weightSame = goal != null && weight === shownBefore;
  const targetKg = weightSame ? goal.targetKg : Number.isFinite(typed) && typed > 0 ? kgFrom(typed, unit) : null;
  const fromKg = goal?.startKg ?? nowKg;
  const fromDay = goal?.startDate ?? today;
  const weeks = by ? daysBetween(fromDay, by) / 7 : null;
  const perWeek = targetKg != null && fromKg != null && weeks && weeks > 0 ? (kgIn(targetKg, unit) - kgIn(fromKg, unit)) / weeks : null;
  const changed = !goal || !weightSame || by !== goal.byDate;
  const ready = targetKg != null && /^\d{4}-\d{2}-\d{2}$/.test(by) && changed;

  const save = () =>
    start(async () => {
      if (targetKg == null) return;
      const res = await saveWeightGoalAction(clientId, { targetKg, unit, byDate: by }, goal?.id);
      if (!res) return;
      if ("error" in res) {
        setRefused(REFUSED[res.error] ?? REFUSED.invalid);
        return;
      }
      router.refresh();
      toast(goal ? "Weight goal changed" : "Weight goal set");
      onDone();
    });
  const remove = () =>
    start(async () => {
      if (!goal) return;
      await deleteWeightGoalAction(clientId, goal.id);
      router.refresh();
      toast("Weight goal removed");
      onDone();
    });

  if (asking && goal)
    return (
      <DialogContent className="dlh" aria-describedby={undefined}>
        <div className="dlh-head">
          <DialogTitle className="dlh-title">Delete {one(kgIn(goal.targetKg, unit))} {unit} goal?</DialogTitle>
          <DialogClose className="dlh-x" aria-label="Close">
            ✕
          </DialogClose>
        </div>
        <p className="dlh-what">It can&rsquo;t be undone.</p>
        <div className="dlh-foot">
          <button type="button" className="dlh-cancel" onClick={() => setAsking(false)}>
            Cancel
          </button>
          <button type="button" className="dlh-delete" disabled={busy} onClick={remove} autoFocus>
            Delete
          </button>
        </div>
      </DialogContent>
    );

  return (
    // No focus ring left on the ✕ as it opens, or on the Goal pill once it closes (2 Nov, Alex: the browser's ring round
    // the pill read as a bigger button than the capsule beside it). A new goal still opens on its weight.
    <DialogContent className="dlh wgd" aria-describedby={undefined} onOpenAutoFocus={(e) => goal && e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{goal ? `${one(kgIn(goal.targetKg, unit))} ${unit} by ${dayMonth(goal.byDate)}` : "New weight goal"}</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <div className="wgd-tags">
        <span className="wgd-tag">
          <WeightGoalIcon size={12} />
          Weight goal
        </span>
        {goal?.verdict && <span className={`trn-state ${VERDICT_TONE[goal.verdict]}`}>{VERDICT_WORD[goal.verdict]}</span>}
      </div>
      <div className="dlh-pair">
        <label className="dlh-field">
          <span className="dlh-label">Goal</span>
          <span className="dlh-suffixed">
            <input
              className="dlh-line"
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6));
                setRefused(null);
              }}
              aria-label={`Goal weight in ${unit}`}
              autoFocus={!goal}
            />
            <small>{unit}</small>
          </span>
        </label>
        <div className="dlh-field">
          <span className="dlh-label">By</span>
          <DatePick
            value={by}
            onChange={(v) => {
              setBy(v);
              setRefused(null);
            }}
            label="By"
            min={today}
            className="dlh-daypick"
          />
        </div>
      </div>
      {/* One live fact (no sentence): where it starts, the pace it asks, how long. */}
      <p className="wgd-fact">
        <SepJoin
          parts={[
            fromKg != null ? `From ${one(kgIn(fromKg, unit))} ${unit}${goal ? ` on ${dayMonth(fromDay)}` : ""}` : null,
            // The sign only once it rounds to something; under two weeks, the days.
            perWeek != null ? `${one(perWeek) === "0" ? "" : perWeek > 0 ? "+" : "−"}${one(Math.abs(perWeek))} ${unit} a week` : null,
            weeks != null && weeks > 0 ? (weeks < 2 ? `${Math.round(weeks * 7)} ${Math.round(weeks * 7) === 1 ? "day" : "days"}` : `${Math.round(weeks)} weeks`) : null,
          ]}
        />
      </p>
      {refused && <p className="dlh-error">{refused}</p>}
      {goal?.settled && (
        <p className="wgd-fact">
          <SepJoin parts={[goal.reachedOn ? `Reached ${dayMonth(goal.reachedOn)}` : "Missed", goal.missedByKg != null ? `${one(kgIn(goal.missedByKg, unit))} ${unit} off` : null]} />
        </p>
      )}
      <div className="dlh-foot">
        {goal && (
          <button type="button" className="dlh-delete wgd-del" onClick={() => setAsking(true)}>
            Delete
          </button>
        )}
        <DialogClose className="dlh-cancel">Cancel</DialogClose>
        <button type="button" className="dlh-go" disabled={!ready || busy} onClick={save}>
          {goal ? "Save" : "Add"}
        </button>
      </div>
    </DialogContent>
  );
}
