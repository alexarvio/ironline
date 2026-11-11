"use client";

import { useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DialogClose, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { WeightGoalIcon } from "../../components/icons";
import { deleteWeightGoalAction, saveWeightGoalAction } from "../../lib/actions";
import { dayMonth } from "../../lib/dayMonth";
import { newOnceKey } from "../../lib/onceKey";
import { kgFrom, kgIn, VERDICT_TONE, VERDICT_WORD, type WeightGoalView } from "../../lib/weightGoal";
import DatePick from "./DatePick";
import { SepJoin } from "./Sep";
import { ConfirmText } from "./ConfirmParts";

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
  initialBy,
  onDone,
}: {
  clientId: number;
  /** The goal to change; none for a new one. */
  goal: WeightGoalView | null;
  /** The coach's unit. */
  unit?: "kg" | "lbs";
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
  const changed = !goal || !weightSame || by !== goal.byDate;
  const ready = targetKg != null && /^\d{4}-\d{2}-\d{2}$/.test(by) && changed;

  const tried = useRef<{ what: string; key: string } | null>(null);
  const save = () => {
    // A new goal's one-time key (6 Nov), made with the tap; the same goal set again after a save that did not come back
    // keeps it, so one that in fact landed is not set twice. A change to a goal needs none.
    const what = JSON.stringify([targetKg, unit, by]);
    const onceKey = goal ? undefined : tried.current?.what === what ? tried.current.key : newOnceKey();
    if (onceKey) tried.current = { what, key: onceKey };
    start(async () => {
      if (targetKg == null) return;
      const res = await saveWeightGoalAction(clientId, { targetKg, unit, byDate: by }, goal?.id, onceKey);
      if (!res) return;
      if ("error" in res) {
        setRefused(REFUSED[res.error] ?? REFUSED.invalid);
        return;
      }
      router.refresh();
      toast(goal ? "Weight goal changed" : "Weight goal set");
      onDone();
    });
  };
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
      // A confirm pop-up (11 Nov, Alex: A of docs/boards/popup-anatomy-mockup.html): the goal named as the card names it,
      // what stays, and Delete the red pill.
      <DialogContent className="dlh">
        <div className="dlh-head">
          <DialogTitle className="dlh-title">
            Delete the weight goal {one(kgIn(goal.targetKg, unit))} {unit} by {dayMonth(goal.byDate)}?
          </DialogTitle>
          <DialogClose className="dlh-x" aria-label="Close">
            ✕
          </DialogClose>
        </div>
        <ConfirmText>The weigh-ins stay on their charts. This can’t be undone.</ConfirmText>
        <div className="dlh-foot">
          <button type="button" className="dlh-cancel" onClick={() => setAsking(false)}>
            Cancel
          </button>
          <button type="button" className="dlh-danger" disabled={busy} onClick={remove} autoFocus>
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
      {/* No `From 90.1 kg | +0.3 kg a week | 6 weeks` line (3 Nov, Alex: "take out… that whole row"). */}
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
